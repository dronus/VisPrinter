
// get a single cookie from this domains cookies
function getCookieValue(cookieName)
{
 var value=null;
 if(document.cookie != "") 
 {
  cookieName=cookieName+"=";
  
  var start=document.cookie.indexOf(cookieName);
  if(start>=0) 
  {
   start=start+cookieName.length;
   
   var end=document.cookie.indexOf(";", start);
   if(end<0) end=document.cookie.length;
   
   value=document.cookie.substring(start,end);
   value=unescape(value);
  }
 }
 return value;
}


// the main reprap printer UI controller
VisPrinter=new function(){

	// if the server is currently connected to a printer
	this.connected=false;

	// the mesh currently previewed, if any
	this.mesh=null; 

	// load a .stl or .gcode file for preview
	this.load=function(file){
		document.getElementById('slicingStyle').innerHTML='.sliced{visibility: hidden;}';
		var reader=new FileReader();
		reader.onload=function(e){
			var text=e.target.result;
			var suffix=file.name.substring(file.name.lastIndexOf('.'));
			if	 (suffix=='.stl'  ) VisPrinter.parseStl(text);
			else if(suffix=='.gcode') {
				VisPrinter.uploadGcode(text);
				VisPrinter.onSliced(text);
			}
			else alert('Bad file type '+suffix);
		}
		reader.onerror=function(e){
			alert(e.message);
		}
		reader.readAsText(file);
	}

	// build a mesh from given polygons for 3d preview
	this.buildMesh = function(polygons) {

		var mesh = new GL.Mesh({ normals: true, colors: true });
		var indexer = new GL.Indexer();
		polygons.map(function(polygon) {
			var indices = polygon.vertices.map(function(vertex) {
				vertex.color = polygon.shared || [1, 1, 1];
				return indexer.add(vertex);
			});
			for (var i = 2; i < indices.length; i++) {
				mesh.triangles.push([indices[0], indices[i - 1], indices[i]]);
			}
		});
		mesh.vertices = indexer.unique.map(function(v) { return [v.pos.x, v.pos.y, v.pos.z]; });
		mesh.normals = indexer.unique.map(function(v) { return [v.normal.x, v.normal.y, v.normal.z]; });
		mesh.colors = indexer.unique.map(function(v) { return v.color; });
		//  mesh.computeWireframe();
		mesh.compile();
		//console.log("Mesh triangles: "+mesh.triangles.length);
		return mesh;
	};

	// parse a .stl file for 3d preview
	this.parseStl=function(stl){

		this.stl=stl;

		var mesh = new GL.Mesh({ normals: true, colors: true });

		var lines=stl.split("\n");
		var triangle=[];
		var index=0;
		for(var i=0; i<lines.length; i++){
			var line=lines[i].trim();
			if (line.indexOf("vertex")>-1){
				var parts=line.split(/ +/);
				var vertex=[parseFloat(parts[1]),parseFloat(parts[2]),parseFloat(parts[3])];
				//var index=indexer.add(vertex);
				triangle.push(index);
				index++;
				if(triangle.length==3) {
					mesh.triangles.push(triangle);
					triangle=[];
				}
				mesh.vertices.push(vertex);
				mesh.colors.push([0,1,1]);
			}
		}
		mesh.computeNormals();	
		mesh.compile();
		this.mesh=mesh;

		this.update();
	}

	// issue a http POST request and call callback on response
	this.httpPost=function(path,data, callback){
		var req = new XMLHttpRequest();
		req.overrideMimeType ( "text / plain"); 
		req.onreadystatechange = function () {
			if (req.readyState == 4) {
				if(req.status!=200) {
						alert("POST failed in "+path+", server response:\n"+req.responseText);
				}
				callback(req.responseText);
			}
		};
		var formData=new FormData();
		for(key in data)
		formData.append(key, data[key]);

		req.open('POST',path, true);
		req.send(formData);
	}

	// issue a http GET request and call callback on response
	this.httpGet=function(path,callback){
		var req = new XMLHttpRequest();
		req.overrideMimeType ( "text / plain"); 
		req.onreadystatechange = function () {
			if (req.readyState == 4) {
				callback(req.responseText);
			}
		};
		req.open('GET',path, true);
		req.send(null);
	}

	// set progress indicator to given value and caption
	// a value of 0 (nothing in progress) and 1 (completed) hides the indicator.
	this.progress=function(caption, p){

		var indic		 =document.getElementById('progress');
		var bar		   =document.getElementById('progressBar');
		var captionElement=document.getElementById('progressName');

		if(!caption) caption='';
		captionElement.innerHTML=caption;

		if (!p || p==1) indic.style.display='none';
		else			indic.style.display='block';
		if(p==1) p=0;
		if(p<0.02) p=0.02;
		bar.style.width=(p*100)+'%';
	}

	// poll /state for UI feedback of printer and slicing state
	this.checkState=function(){
			VisPrinter.httpGet('state',function(result){
				VisPrinter.onState(result);
			});
			window.setTimeout(function(e){VisPrinter.checkState();},500);
	}

	// callback to handle a state report from the server
	this.onState=function(response){
		this.state=JSON.parse(response);
		
		// set progress indicator by ongoing server processes
		this.onProgress(this.state.progress);

		// all boolean state properties are reflected by a visibility CSS class 
		// named .property or .not_property that can be used to show/hide UI elements 
		// depending on state
		var stateStyle="";
		for(key in this.state)
			if	  (this.state[key]===false)
				stateStyle+="."+key+"{visibility: hidden;}\n"
			else if (this.state[key]===true ) 
				stateStyle+=".not_"+key+"{visibility: hidden;}\n";
		var stateElement=document.getElementById('stateStyle');
		if (stateStyle!=stateElement.innerHTML) stateElement.innerHTML=stateStyle;
	}

	// handle a progress change
	this.onProgress=function(response){
		if(!response) response='Idle 0';
		var parts=response.split(' ');
		var caption=parts[0];
		var progress=parseInt(parts[1]);

		this.progress(caption, progress/100);
	}

	// invoke the slicer.
	// first, the .stl to be sliced is uploaded to the server
	// second, if the upload completes, it's callback invokes the slicer
	// third, if the slicer completes, it's callback calls onScliced(...)
	this.slice=function(){
		if(!this.stl){
			alert("Nothing to slice. Load some .stl first.");
			return;
		}

		var config=document.getElementById('config').value;

		// create upload completed callback to invoke slicer
		var onUploaded=function(response){
			this.console.value+="\nSlicing...\n";
			VisPrinter.httpGet('slic3r?config='+config,function(response){
				// slicing completed callback
				VisPrinter.console.value+="\nSlicing complete.\n";
				VisPrinter.onSliced(response)
			});
		}

		// issue request to upload .stl
		this.httpPost('upload',{'stl':this.stl}, onUploaded);
		VisPrinter.progress("Uploading stl...",.5);
		this.console.value+="\nUploading stl...\n";
	}
	
	// upload a ready made .gcode 
	this.uploadGcode=function(text){
		// create callback to give feedback and complete progress indicator
		var onUploaded=function(response){
			VisPrinter.console.value+="\nUploaded.\n";
			VisPrinter.progress();
		}

		// issue .gcode upload request
		this.httpPost('upload',{'gcode':text}, onUploaded);
		this.console.value+="\nUploading gcode...\n";
		VisPrinter.progress("Uploading gcode...",.5);
	}

	// show edit.html for the currently selected config
	this.editConfig=function(){
		var config=document.getElementById('config').value;
		window.open('edit.html?'+config);
	}
	
	// issue G1 gcode to send printer to location given by goto form
	this.goto=function(form){
		var cmd="G1 X"+form.X.value+" Y"+form.Y.value+" Z"+form.Z.value+" E"+form.E.value;
		this.cmd(cmd);
	}

	// get session id from cookie
	this.getSession=function(){
		return getCookieValue("session");
	}

	// issue print command 
	this.print=function(){
		var session=this.getSession();

		this.console.value+="\nPrinting...\n";
		// issue pronsole command
		this.cmd("load tmp/"+session+".gcode\nprint");
	}
	
	// issue pronsole command, calling callback on completion
	// only native pronsole commands like connect, pause etc. give a valid response
	// as printer comamnds like gcodes are handled in background and their responses
	// must be read by fetching the printer log at /printer
	this.cmd=function(cmd,callback){
		var console=document.getElementById('console');
		if(!callback) console.value+="\n>"+cmd+"\n";
		if(!callback) callback=function(response){VisPrinter.onCmd(response)};
		this.httpGet('pronsole?cmd='+encodeURIComponent(cmd), callback);
	}
	
	// default callback for pronsole commands 
	// append the result to console textarea
	this.onCmd=function(result){
		var console=document.getElementById('console');
		console.value+=result;
		console.scrollTop = console.scrollHeight;
	}
		
	// slicing completed handler
	// the received gcode is parsed and a line mesh is build to preview the printer pathes
	this.onSliced=function(gcode){
		this.gcode=gcode;

		// create a line mesh
		var mesh = new GL.Mesh({ triangles: false, lines: true, colors: true });

		// parse gcode and add lines
		var pos={'X':0.0, 'Y':0.0, 'Z':0.0};
		var lines=gcode.split("\n");
		var index=0;
		for(var i=0; i<lines.length; i++)
		{
			var line=lines[i];
			var parts=line.split(" ");
			if(parts[0]=='G1'){
				for(var j=1; j<parts.length; j++){
					var part=parts[j];
					var axis=part.substr(0,1);
					var value=parseFloat(part.substr(1));
					pos[axis]=value;
				}
				mesh.vertices.push([pos.X-100, pos.Y-100, pos.Z]);
				if(index>0) {
					mesh.lines.push([index-1, index]);
					mesh.colors.push([1,0,0]);
				}
				index++;		
			}
		}
		mesh.compile();
		this.mesh=mesh;
		// show mesh
		this.update();
		document.getElementById('slicingStyle').innerHTML='';
	}
	
	// establish connection to printer
	this.connect=function(){
		// issue pronsole connect command
		this.cmd('connect');			
	}

	// repeatedly poll printer output buffer from server
	// this is done every second if a printer is connected, and every 10 seconds
	// if not, as connecting takes about 10s to succeed. 
	// TODO it would be better to let the server retry the printer connection, or
	// to retry connect indipendently of the check polling so we can poll the state 
	// as often we like to stay responsive for printerless use (eg. slicing).
	this.check=function(){
	
		// issue /check request, calling onCheck on response
		VisPrinter.httpGet('printer',function(result){
			VisPrinter.onCheck(result);
		});


		if(!this.connected) {
			// not connected to the printer, try to connect and check again in 10s
			this.connect();
			window.setTimeout(function(e){VisPrinter.check();},10000);
		}
		else
			// the printer is connected, check again in one second
			window.setTimeout(function(e){VisPrinter.check();},1000);
	}

	// printer output response handler
	// refreshes the this.connected state and corresponding UI
	// adds messages to the console textarea
	this.onCheck=function(result){
		var lines=result.split('\n')			
		for(var i=0; i<lines.length; i++){
			var line=lines[i];
			if(!line) continue;
			if(line.indexOf('ok ')==0) {
				// we received an 'ok', so consider the printer connected
				this.connected=true;
				document.getElementById('connection'	 ).innerHTML='connected';
				document.getElementById('connectionStyle').innerHTML='';
			}
			// echo printer output to console textarea
			this.console.value+=line+"\n";
		}
	}

	// /config response handler
	// fills in the config selector dropdown
	this.onConfigs=function(response){
		var configs=response.split("\n");
		var select=document.getElementById('config');
		for(var i=0; i<configs.length; i++){
			var config=configs[i];
			if(!config) continue;
			var option=document.createElement('option');
			option.value=config;
			option.innerHTML=config.substr(config.indexOf('/')+1);
			select.add(option);
		}	
	}

	// request server /cancel 
	// this cancels the current operation, that may be a slicing or printing operation
	this.cancel=function(){
			this.httpGet('cancel');
	}
	
	// update the 3d preview to show our current mesh
	this.update=function(){
		viewer.mesh=this.mesh;
		// adjust camera to show anything
		viewer.showAll();
		viewer.gl.ondraw();
	}

	// attach this VisPrinter controller to a HTML UI
	// the html need to provide several UI elements and classes
	// see index.html 
	this.attach=function(){
		var viewPane=document.getElementById('view');
		if(viewPane) {
			viewer = new Viewer(viewPane);
			viewer.showAll();
		}
		this.console=document.getElementById('console');
		var VisPrinter=this;
		this.check();
		this.checkState();
		this.httpGet('configs',function(response){VisPrinter.onConfigs(response)});
	}
}



