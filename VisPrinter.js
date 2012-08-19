

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


	this.loadStl=function(file){
		var reader=new FileReader();
		reader.onload=function(e){
			var stl=e.target.result;
			VisPrinter.parseStl(stl);
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
                            if(req.status!=200) {
                                    alert("GET failed in "+path+", server response:\n"+req.responseText);
                            }
                    callback(req.responseText);
                }
            };
        req.open('GET',path, true);
        req.send(null);
    }

	this.slice=function(){
		if(!this.stl){
			alert("Nothing to slice. Load some .stl first.");
			return;
		}
		
		this.httpPost('slic3r',{'config':'', 'stl':this.stl}, function(response){VisPrinter.onSliced(response)});
	}
	
	this.goto=function(form){
        var cmd="G1 X"+form.X.value+" Y"+form.Y.value+" Z"+form.Z.value+" E"+form.E.value;
        this.cmd(cmd);
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
	}
		
	this.onSliced=function(gcode){
		this.console.value+=gcode;
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
	}
	
	this.connected=false;
	this.connect=function(){
	    document.getElementById('connection').innerHTML='connecting...';
	    this.cmd('connect',function(result){
	        //TODO handle connection
	        
	        document.getElementById('connection').innerHTML=this.connection ? 'not connected' : 'connected';
	    });	    
	}
	
	this.check=function(){
	    if(!this.connected) 
	        this.connect();	
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
		viewer = new Viewer(document.getElementById('view'));
		this.console=document.getElementById('console');
		var VisPrinter=this;
		window.addEventListener('keypress', function(e){VisPrinter.keypress(e)} ,false);
		window.setInterval(function(e){VisPrinter.check();},1000);
//		window.addEventListener("hashchange", function(e){VisPrinter.hashchange(e)}, false);
//		this.hashchange();
		viewer.showAll();		
	}
}



