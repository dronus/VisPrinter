

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



VisPrinter=new function(){

	this.load=function(file){
		document.getElementById('slicingStyle').innerHTML='.sliced{visibility: hidden;}';
		var reader=new FileReader();
		reader.onload=function(e){
			var text=e.target.result;
			var suffix=file.name.substring(file.name.lastIndexOf('.'));
			if     (suffix=='.stl'  ) VisPrinter.parseStl(text);
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

	this.mesh=null; 

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

    this.httpGet=function(path,callback){
            var req = new XMLHttpRequest();
            req.overrideMimeType ( "text / plain"); 
            req.onreadystatechange = function () {
                if (req.readyState == 4) {
/*                            if(req.status!=200) {
                                    alert("GET failed in "+path+", server response:\n"+req.responseText);
                            }*/
                    callback(req.responseText);
                }
            };
        req.open('GET',path, true);
        req.send(null);
    }


	this.progress=function(caption, p){

		var indic         =document.getElementById('progress');
		var bar           =document.getElementById('progressBar');
		var captionElement=document.getElementById('progressName');

		if(!caption) caption='';
		captionElement.innerHTML=caption;

		if (!p || p==1) indic.style.display='none';
		else            indic.style.display='block';
		if(p==1) p=0;
		if(p<0.02) p=0.02;
		bar.style.width=(p*100)+'%';
	}

	this.onState=function(response){
		this.state=JSON.parse(response);
		
		this.onProgress(this.state.progress);

		// all boolean state properties are reflected by a visibility CSS class 
		// named .property or .not_property that can be used to show UI elements 
		// depending on state
		var stateStyle="";
		for(key in this.state)
			if      (this.state[key]===false)
				stateStyle+="."+key+"{visibility: hidden;}\n"
			else if (this.state[key]===true ) 
				stateStyle+=".not_"+key+"{visibility: hidden;}\n";
		var stateElement=document.getElementById('stateStyle');
		if (stateStyle!=stateElement.innerHTML) stateElement.innerHTML=stateStyle;
	}

	this.onProgress=function(response){
		if(!response) response='Idle 0';
		var parts=response.split(' ');
		var caption=parts[0];
		var progress=parseInt(parts[1]);

		this.progress(caption, progress/100);
	}

	this.slice=function(){
		if(!this.stl){
			alert("Nothing to slice. Load some .stl first.");
			return;
		}

		var config=document.getElementById('config').value;
		var onUploaded=function(response){
			this.console.value+="\nSlicing...\n";
			VisPrinter.httpGet('slic3r?config='+config,function(response){
				VisPrinter.console.value+="\nSlicing complete.\n";
				VisPrinter.onSliced(response)
			});
		}

		this.httpPost('upload',{'stl':this.stl}, onUploaded);
		VisPrinter.progress("Uploading stl...",.5);
		this.console.value+="\nUploading stl...\n";
	}
	this.uploadGcode=function(text){
		var onUploaded=function(response){
			VisPrinter.console.value+="\nUploaded.\n";
			VisPrinter.progress();
		}

		this.httpPost('upload',{'gcode':text}, onUploaded);
		this.console.value+="\nUploading gcode...\n";
		VisPrinter.progress("Uploading gcode...",.5);
	}

	this.editConfig=function(){
		var config=document.getElementById('config').value;
		window.open('edit.html?'+config);
	}
	
	this.goto=function(form){
        var cmd="G1 X"+form.X.value+" Y"+form.Y.value+" Z"+form.Z.value+" E"+form.E.value;
        this.cmd(cmd);
	}

	this.getSession=function(){
		return getCookieValue("session");
	}

	this.print=function(){
		var session=this.getSession();

		this.console.value+="\nPrinting...\n";
		this.cmd("load tmp/"+session+".gcode\nprint");
	}
	
	this.cmd=function(cmd,callback){
	    var console=document.getElementById('console');
	    if(!callback) console.value+="\n>"+cmd+"\n";
	    if(!callback) callback=function(response){VisPrinter.onCmd(response)};
		this.httpGet('pronsole?cmd='+encodeURIComponent(cmd), callback);
	}
	
	this.onCmd=function(result){
		var console=document.getElementById('console');
		console.value+=result;
		console.scrollTop = console.scrollHeight;
	}
		
	this.onSliced=function(gcode){
		this.gcode=gcode;

		var mesh = new GL.Mesh({ triangles: false, lines: true, colors: true });

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
		this.update();
		document.getElementById('slicingStyle').innerHTML='';
	}
	
	this.connected=false;
	this.connect=function(){
//	    document.getElementById('connection').innerHTML='connecting...';
	    this.cmd('connect');            
	}
	
	this.check=function(){
            VisPrinter.httpGet('printer',function(result){
                VisPrinter.onCheck(result);
            });

	    if(!this.connected) {
	        this.connect();
	        window.setTimeout(function(e){VisPrinter.check();},10000);
	    }
            else
                window.setTimeout(function(e){VisPrinter.check();},1000);
	}

        this.onCheck=function(result){
            var lines=result.split('\n')            
            for(var i=0; i<lines.length; i++){
                var line=lines[i];
                if(!line) continue;
                if(line.indexOf('ok ')==0) {
			this.connected=true;
			    document.getElementById('connection'     ).innerHTML='connected';
			    document.getElementById('connectionStyle').innerHTML='';
		}
		this.console.value+=line+"\n";
            }
        }

	this.checkState=function(){
            VisPrinter.httpGet('state',function(result){
                VisPrinter.onState(result);
            });
            window.setTimeout(function(e){VisPrinter.checkState();},500);
	}

	this.hashchange=function(data)
	{
		if(this.justSaved) {
			this.justSaved=false;
			return;
		}
		if(document.location.hash)
			data=document.location.hash.substring(1);
		if(data){
			this.sceneTree=JSON.parse(data);
			this.convertLegacy(this.sceneTree);
			this.csgWorker.csgCache={};
		}
		this.updateTreeView();
		this.update();
	}

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

	this.pause=function(){
		this.cmd("pause");
	}
	this.resume=function(){
		this.cmd("resume");
	}

	this.cancel=function(){
            this.httpGet('cancel');
	}
	
	this.update=function(){
		//viewer.mesh=viewer.buildMesh(this.csgWorker.getPolygons(this.sceneTree,'root'));
		viewer.mesh=this.mesh;
		viewer.showAll();
		viewer.gl.ondraw();
	}

	this.keypress=function(e){
		if(e.target.tagName=='INPUT') return;
		if(e.charCode=='x'.charCodeAt(0)) this.cut();
		if(e.charCode=='c'.charCodeAt(0)) this.copy();
		if(e.charCode=='v'.charCodeAt(0)) this.paste();
		if(e.charCode=='y'.charCodeAt(0)) this.deselect();
	};

	this.attach=function(){
		var viewPane=document.getElementById('view');
		if(viewPane) {
			viewer = new Viewer(viewPane);
			viewer.showAll();
		}
		this.console=document.getElementById('console');
		var VisPrinter=this;
		window.addEventListener('keypress', function(e){VisPrinter.keypress(e)} ,false);
		this.check();
		this.checkState();
		this.httpGet('configs',function(response){VisPrinter.onConfigs(response)});
//		window.addEventListener("hashchange", function(e){VisPrinter.hashchange(e)}, false);
//		this.hashchange();
		

	}
}



