// Convert from CSG solid to GL.Mesh object


Viewer=function(container) {
	this.rotSpeed=.3;
	this.moveSpeed=.001;
	this.zoomSpeed=.002;
	
	this.angleX = 20;
	this.angleY = 20;
	this.posX=0;
	this.posY=0;
	this.posZ=5;

	// Get a new WebGL canvas
	var gl = GL.create();
	this.gl = gl;
	this.mesh = null; //buildMesh(csg.polygons);

	// Set up the viewport
//	gl.matrixMode(gl.PROJECTION);
//	gl.loadIdentity();
//	gl.perspective(45, width / height, 0.1, 100);
	gl.matrixMode(gl.MODELVIEW);

	// Set up WebGL state
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
	gl.clearColor(0, 0, 0, .1);
	gl.enable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);
	gl.enable(gl.BLEND);
	gl.polygonOffset(1, 1);

	// Black shader for wireframe
	this.blackShader = new GL.Shader('\
		void main() {\
			gl_Position = gl_ModelViewProjectionMatrix * gl_Vertex;\
		}\
		', '\
		void main() {\
			gl_FragColor = vec4(0.0, 0.0, 0.0, 0.1);\
		}\
	');

	// Shader with diffuse and specular lighting
	this.lightingShader = new GL.Shader('\
		varying vec3 color;\
		varying vec3 normal;\
		varying vec3 light;\
		void main() {\
			const vec3 lightDir = vec3(1.0, 2.0, 3.0) / 3.741657386773941;\
			light = (gl_ModelViewMatrix * vec4(lightDir, 0.0)).xyz;\
			color = gl_Color.rgb;\
			normal = gl_NormalMatrix * gl_Normal;\
			gl_Position = gl_ModelViewProjectionMatrix * gl_Vertex;\
		}\
		', '\
		varying vec3 color;\
		varying vec3 normal;\
		varying vec3 light;\
		uniform float alpha;\
		void main() {\
			vec3 n = normalize(normal);\
			float diffuse = max(0.0, dot(light, n));\
			float specular = pow(max(0.0, -reflect(light, n).z), 32.0) * sqrt(diffuse);\
			gl_FragColor = vec4(mix(color * (0.3 + 0.7 * diffuse), vec3(1.0), specular), alpha);\
		}\
	');

	// Black shader for wireframe
	this.blackShader = new GL.Shader('\
		void main() {\
			gl_Position = gl_ModelViewProjectionMatrix * gl_Vertex;\
		}\
		', '\
		void main() {\
			gl_FragColor = vec4(0.0, 0.0, 0.0, 0.1);\
		}\
	');

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

	this.showAll=function(){
		var sphere=this.mesh.getBoundingSphere();
		this.posZ=sphere.radius*3;
	}

	var that = this;

	gl.onmousemove = function(e) {
		if (e.dragging) {
			var b=e.original.button;
			if(b==0 && !e.shiftKey && !e.altKey && !e.ctrlKey){
				that.angleY += e.deltaX * that.rotSpeed;
				that.angleX += e.deltaY * that.rotSpeed;
				that.angleX = Math.max(-90, Math.min(90, that.angleX));
			}else if(b==1 || (b==0 && e.shiftKey &&!e.altKey && !e.ctrlKey )){
				that.posX+=e.deltaX * that.posZ  * that.moveSpeed;
				that.posY-=e.deltaY * that.posZ * that.moveSpeed;
			}else if(b==0 && !e.shiftKey &&!e.altKey && e.ctrlKey ){
				var delta=1-e.deltaY*that.zoomSpeed;
				that.posZ*=delta;      
			}
			viewer.gl.ondraw();
		}
	};

	gl.canvas.addEventListener('mousewheel',function(event){
		var delta=1-event.wheelDelta*that.zoomSpeed;
		that.posZ*=delta;
		that.gl.ondraw();
	});

	this.ondraws=[];

	gl.ondraw = function() {
		gl.makeCurrent();

		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.loadIdentity();
		gl.translate(that.posX, that.posY, -that.posZ);
		gl.rotate(that.angleX, 1, 0, 0);
		gl.rotate(that.angleY, 0, 1, 0);

		if(that.mesh){
			gl.enable(gl.POLYGON_OFFSET_FILL);
			that.lightingShader.uniforms({alpha: 1.0}).draw(that.mesh, gl.TRIANGLES);
			gl.disable(gl.POLYGON_OFFSET_FILL);
		}
		//gl.disable(gl.DEPTH_TEST);
		//    that.blackShader.draw(that.mesh, gl.LINES);
		for(var i=0; i<that.ondraws.length; i++)
			that.ondraws[i](that, gl);
		//gl.enable(gl.DEPTH_TEST);
	};

	this.resize=function(){
		var canvas=this.gl.canvas;
		var w=canvas.parentNode.offsetWidth;
		var h=canvas.parentNode.offsetHeight;
		var gl=this.gl;
		gl.canvas.width=w; canvas.height=h;
		gl.viewport(0, 0,w,h);
		gl.matrixMode(gl.PROJECTION);
		gl.loadIdentity();
		gl.perspective(45, w / h, 0.1, 1000);
		gl.matrixMode(gl.MODELVIEW);
		gl.ondraw();
	};

	container.appendChild(gl.canvas);
	window.addEventListener("resize",function(){that.resize()},false);    
	this.resize();
}


