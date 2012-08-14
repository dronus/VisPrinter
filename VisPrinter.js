

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
		var VisPrinter=this;
		window.addEventListener('keypress', function(e){VisPrinter.keypress(e)} ,false);
//		window.addEventListener("hashchange", function(e){VisPrinter.hashchange(e)}, false);
//		this.hashchange();
		viewer.showAll();		
	}
}


