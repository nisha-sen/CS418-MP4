/**
 * @file MP4: A Simple Physics Engine
 * @author Nisha Sen <nishams2@illinois.edu>
 * code based off of helloPhong code from course website
 */
// WebGL context, canvas, shaderprogram, and vertex position buffer objects
var gl;
var canvas;
var shaderProgram;
var vertexPositionBuffer;

// Gravity, used in calculation of acceleraton
var gravity = 9.8;

// Factor to account for friction/loss of velocity when hitting the wall
var bounceFactor = 0.9;

// Create a place to store sphere geometry
var sphereVertexPositionBuffer;

//Create a place to store normals for shading
var sphereVertexNormalBuffer;

// View parameters
var eyePt = glMatrix.vec3.fromValues(0.0,0.0,60.0);
var viewDir = glMatrix.vec3.fromValues(0.0,0.0,-1.0);
var up = glMatrix.vec3.fromValues(0.0,1.0,0.0);
var viewPt = glMatrix.vec3.fromValues(0.0,0.0,0.0);

// Create the normal
var nMatrix = glMatrix.mat3.create();

// Create ModelView matrix
var mvMatrix = glMatrix.mat4.create();

//Create Projection matrix
var pMatrix = glMatrix.mat4.create();

var mvMatrixStack = [];

// Object for keystrokes
var currentlyPressedKeys = {};

// Light parameters

//light position
var lightx=1.0;
var lighty=1.0;
var lightz=1.0;

//light intensity
var alight =0.0;
var dlight =1.0;
var slight =1.0;

//array to store particles
var particles = [];

//default number of particles
var particleNum = 5;

//-----------------------------------------------------------------
//Color conversion  helper functions
function hexToR(h) {return parseInt((cutHex(h)).substring(0,2),16)}
function hexToG(h) {return parseInt((cutHex(h)).substring(2,4),16)}
function hexToB(h) {return parseInt((cutHex(h)).substring(4,6),16)}
function cutHex(h) {return (h.charAt(0)=="#") ? h.substring(1,7):h}

//----------------------------------------------------------------------------------------------

/**
 * Class to handle with the particle system
 */

class Particle {
    /**
     * constructor for the Particle object
     */
    constructor() {
        //position array
        this.p = glMatrix.vec3.create();
        //set initial position to be some random point on the screen
        glMatrix.vec3.random(this.p);
        //velocity array
        this.v = glMatrix.vec3.create();
        //set initial velocity for a particle to be random
        glMatrix.vec3.random(this.v);
        //acceleration array, determined with gravity
        this.a = glMatrix.vec3.fromValues(0, -0.2 * gravity, 0);
        //acceleration factor from bouncing off the wall
        //this.wallaccel = 0.75;
        
        //drag constant
        this.drag = 0.9;
        
        //radius
        this.r = (Math.random() / 2 + 0.07);
        
        //set random color for each particle
        this.R = Math.random();
        this.G = Math.random();
        this.B = Math.random();
        
    }
    
    /** function to update position for the particle as time passes; pass time into function
     * from slides, using Euler integration:
     * position_new = position_old + velocity * time
     */
    updatePosition(time) {
        //velocity factor to add to update position vector
        var velFactor = glMatrix.vec3.create();
        glMatrix.vec3.scale(velFactor, this.v, time);
        glMatrix.vec3.add(this.p, this.p, velFactor);
        
        //Sphere-wall collision detection for when sphere bounce against viewing frame's wall; handle particles hitting the wall
        //i < 3 since position array is a vec3
        //bounds on the wall are +- 1; if particle position is > 1 or < -1, handle collision
        for(var i = 0; i < 3; i++) {
            if (this.p[i] < -1) {
                this.p[i] = -1;
                //reflect the particle so it bounces off the wall and slows down a bit
                this.v[i] = -this.v[i] * bounceFactor;
            }
            if (this.p[i] > 1) {
                this.p[i] = 1;
                //reflect the particle so it bounces off the wall and slows down a bit
                this.v[i] = -this.v[i] * bounceFactor;
            }
        }
        
    }
    
    /** function to update velocity for the particle as time passes; pass time into function
     * from slides, using Euler integration:
     * velocity_new = velocity_old * d^t + acceleration * time
     */
    updateVelocity(time) {
        //acceleration factor to add to update the velocity vector
        var accelFactor = glMatrix.vec3.create();
        glMatrix.vec3.scale(this.v, this.v, Math.pow(this.drag, time));
        glMatrix.vec3.scale(accelFactor, this.a, time);
        glMatrix.vec3.add(this.v, this.v, accelFactor);
    }
}

//-------------------------------------------------------------------------
/**
 * Populates buffers with data for spheres
 */
function setupSphereBuffers() {
    
    var sphereSoup=[];
    var sphereNormals=[];
    var numT=sphereFromSubdivision(6,sphereSoup,sphereNormals);
    console.log("Generated ", numT, " triangles"); 
    sphereVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexPositionBuffer);      
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphereSoup), gl.STATIC_DRAW);
    sphereVertexPositionBuffer.itemSize = 3;
    sphereVertexPositionBuffer.numItems = numT*3;
    console.log(sphereSoup.length/9);
    
    // Specify normals to be able to do lighting calculations
    sphereVertexNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphereNormals),
                  gl.STATIC_DRAW);
    sphereVertexNormalBuffer.itemSize = 3;
    sphereVertexNormalBuffer.numItems = numT*3;
    
    console.log("Normals ", sphereNormals.length/3);     
}

//-------------------------------------------------------------------------
/**
 * Draws a sphere from the sphere buffer
 */
function drawSphere(){
 gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexPositionBuffer);
 gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, sphereVertexPositionBuffer.itemSize, 
                         gl.FLOAT, false, 0, 0);

 // Bind normal buffer
 gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexNormalBuffer);
 gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, 
                           sphereVertexNormalBuffer.itemSize,
                           gl.FLOAT, false, 0, 0);
 gl.drawArrays(gl.TRIANGLES, 0, sphereVertexPositionBuffer.numItems);      
}

//-------------------------------------------------------------------------
/**
 * Sends Modelview matrix to shader
 */
function uploadModelViewMatrixToShader() {
  gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
}

//-------------------------------------------------------------------------
/**
 * Sends projection matrix to shader
 */
function uploadProjectionMatrixToShader() {
  gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, 
                      false, pMatrix);
}

//-------------------------------------------------------------------------
/**
 * Generates and sends the normal matrix to the shader
 */
function uploadNormalMatrixToShader() {
  glMatrix.mat3.fromMat4(nMatrix,mvMatrix);
  glMatrix.mat3.transpose(nMatrix,nMatrix);
  glMatrix.mat3.invert(nMatrix,nMatrix);
  gl.uniformMatrix3fv(shaderProgram.nMatrixUniform, false, nMatrix);
}

//----------------------------------------------------------------------------------
/**
 * Pushes matrix onto modelview matrix stack
 */
function mvPushMatrix() {
    var copy = glMatrix.mat4.clone(mvMatrix);
    mvMatrixStack.push(copy);
}


//----------------------------------------------------------------------------------
/**
 * Pops matrix off of modelview matrix stack
 */
function mvPopMatrix() {
    if (mvMatrixStack.length == 0) {
      throw "Invalid popMatrix!";
    }
    mvMatrix = mvMatrixStack.pop();
}

//----------------------------------------------------------------------------------
/**
 * Sends projection/modelview matrices to shader
 */
function setMatrixUniforms() {
    uploadModelViewMatrixToShader();
    uploadNormalMatrixToShader();
    uploadProjectionMatrixToShader();
}

//----------------------------------------------------------------------------------
/**
 * Translates degrees to radians
 * @param {Number} degrees Degree input to function
 * @return {Number} The radians that correspond to the degree input
 */
function degToRad(degrees) {
        return degrees * Math.PI / 180;
}

//----------------------------------------------------------------------------------
/**
 * Creates a context for WebGL
 * @param {element} canvas WebGL canvas
 * @return {Object} WebGL context
 */
function createGLContext(canvas) {
  var names = ["webgl", "experimental-webgl"];
  var context = null;
  for (var i=0; i < names.length; i++) {
    try {
      context = canvas.getContext(names[i]);
    } catch(e) {}
    if (context) {
      break;
    }
  }
  if (context) {
    context.viewportWidth = canvas.width;
    context.viewportHeight = canvas.height;
  } else {
    alert("Failed to create WebGL context!");
  }
  return context;
}

//----------------------------------------------------------------------------------
/**
 * Loads Shaders
 * @param {string} id ID string for shader to load. Either vertex shader/fragment shader
 */
function loadShaderFromDOM(id) {
  var shaderScript = document.getElementById(id);
  
  // If we don't find an element with the specified id
  // we do an early exit 
  if (!shaderScript) {
    return null;
  }
  
  // Loop through the children for the found DOM element and
  // build up the shader source code as a string
  var shaderSource = "";
  var currentChild = shaderScript.firstChild;
  while (currentChild) {
    if (currentChild.nodeType == 3) { // 3 corresponds to TEXT_NODE
      shaderSource += currentChild.textContent;
    }
    currentChild = currentChild.nextSibling;
  }
 
  var shader;
  if (shaderScript.type == "x-shader/x-fragment") {
    shader = gl.createShader(gl.FRAGMENT_SHADER);
  } else if (shaderScript.type == "x-shader/x-vertex") {
    shader = gl.createShader(gl.VERTEX_SHADER);
  } else {
    return null;
  }
 
  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);
 
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  } 
  return shader;
}

//----------------------------------------------------------------------------------
/**
 * Setup the fragment and vertex shaders
 */
function setupShaders(vshader,fshader) {
  vertexShader = loadShaderFromDOM(vshader);
  fragmentShader = loadShaderFromDOM(fshader);
  
  shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert("Failed to setup shaders");
  }

  gl.useProgram(shaderProgram);

  shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
  gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

  shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aVertexNormal");
  gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);

  shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
  shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
  shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");
  shaderProgram.uniformLightPositionLoc = gl.getUniformLocation(shaderProgram, "uLightPosition");    
  shaderProgram.uniformAmbientLightColorLoc = gl.getUniformLocation(shaderProgram, "uAmbientLightColor");  
  shaderProgram.uniformDiffuseLightColorLoc = gl.getUniformLocation(shaderProgram, "uDiffuseLightColor");
  shaderProgram.uniformSpecularLightColorLoc = gl.getUniformLocation(shaderProgram, "uSpecularLightColor");
  shaderProgram.uniformDiffuseMaterialColor = gl.getUniformLocation(shaderProgram, "uDiffuseMaterialColor");
  shaderProgram.uniformAmbientMaterialColor = gl.getUniformLocation(shaderProgram, "uAmbientMaterialColor");
  shaderProgram.uniformSpecularMaterialColor = gl.getUniformLocation(shaderProgram, "uSpecularMaterialColor");

  shaderProgram.uniformShininess = gl.getUniformLocation(shaderProgram, "uShininess");    
}


//-------------------------------------------------------------------------
/**
 * Sends material information to the shader
 * @param {Float32Array} a diffuse material color
 * @param {Float32Array} a ambient material color
 * @param {Float32Array} a specular material color 
 * @param {Float32} the shininess exponent for Phong illumination
 */
function uploadMaterialToShader(dcolor, acolor, scolor, shiny) {
  gl.uniform3fv(shaderProgram.uniformDiffuseMaterialColor, dcolor);
  gl.uniform3fv(shaderProgram.uniformAmbientMaterialColor, acolor);
  gl.uniform3fv(shaderProgram.uniformSpecularMaterialColor, scolor);
    
  gl.uniform1f(shaderProgram.uniformShininess, shiny);
}

//-------------------------------------------------------------------------
/**
 * Sends light information to the shader
 * @param {Float32Array} loc Location of light source
 * @param {Float32Array} a Ambient light strength
 * @param {Float32Array} d Diffuse light strength
 * @param {Float32Array} s Specular light strength
 */
function uploadLightsToShader(loc,a,d,s) {
  gl.uniform3fv(shaderProgram.uniformLightPositionLoc, loc);
  gl.uniform3fv(shaderProgram.uniformAmbientLightColorLoc, a);
  gl.uniform3fv(shaderProgram.uniformDiffuseLightColorLoc, d);
  gl.uniform3fv(shaderProgram.uniformSpecularLightColorLoc, s); 
}

//----------------------------------------------------------------------------------
/**
 * Populate buffers with data
 */
function setupBuffers() {
    setupSphereBuffers();     
}

//-----------------------------------------------------------------------------------
/**
 * Function to initialize the particles; function/animation to be called from tick
 */
function setupParticles() {
    for (var i = 0; i < particleNum; i++) {
        particles.push(new Particle());
    }
}

//----------------------------------------------------------------------------------
/**
 * Draw call that applies matrix transformations to model and draws model in frame
 */
function draw() { 
    var transformVec = glMatrix.vec3.create();
  
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // We'll use perspective 
    glMatrix.mat4.perspective(pMatrix,degToRad(90), gl.viewportWidth / gl.viewportHeight, 0.1, 200.0);

    // We want to look down -z, so create a lookat point in that direction    
    glMatrix.vec3.add(viewPt, eyePt, viewDir);
    // Then generate the lookat matrix and initialize the MV matrix to that view
    glMatrix.mat4.lookAt(mvMatrix, eyePt, viewPt, up); 
    // Put light position into VIEW COORDINATES
    //var lightPos = glMatrix.vec4.fromValues(lightx,lighty,lightz,1.0);
    //glMatrix.vec4.transformMat4(lightPos,lightPos,mvMatrix);
    //lightx=lightPos[0];
    //lighty=lightPos[1];
    //lightz=lightPos[2];
 
   // glMatrix.vec3.set(transformVec,20,20,20);
    //glMatrix.mat4.scale(mvMatrix, mvMatrix,transformVec);
    
    //draw each particle, translate position, scale, set color
    for (var i = 0; i < particleNum; i++) {
        mvPushMatrix();
        particleUpdate();
        //particles[i] = updatePosition(0.1);
        //particles[i] = updateVelocity(0.1);
        glMatrix.mat4.translate(mvMatrix, mvMatrix, particles[i].p);
        glMatrix.mat4.scale(mvMatrix, mvMatrix, particles[i].r);
        
        //set color
        R = particles[i].R;
        G = particles[i].G;
        B = particles[i].B;
    
        //Get shiny
        shiny = 100;
    
        uploadLightsToShader([20,20,20],[0.0,0.0,0.0],[1.0,1.0,1.0],[1.0,1.0,1.0]);
        uploadMaterialToShader([R,G,B],[R,G,B],[1.0,1.0,1.0],shiny);
        setMatrixUniforms();
        drawSphere();
        mvPopMatrix();
    }
    
    //Get material color
    //colorVal = document.getElementById("mat-color").value
   /* R = hexToR(colorVal)/255.0;
    G = hexToG(colorVal)/255.0;
    B = hexToB(colorVal)/255.0;
    
    //Get shiny
    shiny = 100;
    
    //uploadLightsToShader([lightx,lighty,lightz],[alight,alight,alight],[dlight,dlight,dlight],[slight,slight,slight]);
    uploadMaterialToShader([R,G,B],[R,G,B],[1.0,1.0,1.0],shiny);
    setMatrixUniforms();
    drawSphere(); */
}

//----------------------------------------------------------------------------------
/**
 * Animation to be called from tick. Updates globals and performs animation for each tick.
 */
/*function animate() {
    lightx= document.getElementById("xlight").value;
    lighty= document.getElementById("ylight").value;
    lightz =document.getElementById("zlight").value;
    alight =document.getElementById("ambient").value;
    dlight =document.getElementById("diffuse").value;
    slight =document.getElementById("specular").value;
} */

//----------------------------------------------------------------------------------
/**
 * Animation to be called from tick. Updates globals and performs animation for each tick.
 */
function setPhongShader() {
    console.log("Setting Phong shader");
    setupShaders("shader-phong-phong-vs","shader-phong-phong-fs");
}

//----------------------------------------------------------------------------------
/**
 * Animation to be called from tick. Updates globals and performs animation for each tick.
 */
function setGouraudShader() {
    console.log("Setting Gouraud Shader");
    setupShaders("shader-gouraud-phong-vs","shader-gouraud-phong-fs");
}


//----------------------------------------------------------------------------------
/**
 * Startup function called from html code to start program.
 */
 function startup() {
     canvas = document.getElementById("myGLCanvas");
     gl = createGLContext(canvas);
     //setupShaders("shader-vs","shader-fs");
     //setPhongShader();
     setGouraudShader();
     setupBuffers();
     gl.clearColor(0.0, 0.0, 0.0, 1.0);
     gl.enable(gl.DEPTH_TEST);
     document.onkeydown = handleKeyDown;
     document.onkeyup = handleKeyUp;
     tick();
}

//----------------------------------------------------------------------------------
/**
 * Tick called for every animation frame.
 */
function tick() {
    requestAnimFrame(tick);
    setupParticles();
    //particleUpdate();
    draw();
    //animate();
}

//-------------------------------------------------------------------------------------
/**
 * Function to update the particle positions, velocities
 */
function particleUpdate() {
    for (var i = 0; i < particles.length; i++) {
        particles[i].updatePosition(0.1);
        particles[i].updateVelocity(0.1);
    }
}

//------------------------------------------------------------------------------------
/**
 * Code to handle user interaction (starter code from lecture + code from my MP2-2)
 */

function handleKeyDown(event) {
    console.log("Key down ", event.key, " code ", event.code);
    if (event.key == "ArrowDown" || event.key == "ArrowUp" || event.key == "ArrowLeft" || event.key == "ArrowRight") {
        event.preventDefault();
    }
    
    currentlyPressedKeys[event.key] = true;

    //if key = o, add one particle
    if (currentlyPressedKeys["o"]) {
        particleNum = particleNum + 1;
    }
    //if key = p, add five particles
    if (currentlyPressedKeys["p"]) {
        particleNum = particleNum + 5;
    }
    //if key = r, remove all particles
    if (currentlyPressedKeys["r"]) {
        particles = [];
        particleNum = 0;
    }
    //if key = n, reset particles on screen to 1
    if (currentlyPressedKeys["n"]) {
        particles = [];
        particleNum = 1;   
    }
}

function handleKeyUp(event) {
    // console.log("Key up ", event.key, " code ", event.code);
    currentlyPressedKeys[event.key] = false;
}
