/*************************************
 *  Subdiving a cube
**************************************/

var BACKGROUND = color(250, 250, 250);
var SHADE = color(80, 80, 80);
var GREY = color(100, 100, 100);
var BLUE = color(64, 95, 237);
var PINK = color(255, 0, 175);
var GREEN = color(28, 173, 123);
var ORANGE = color(255, 165, 0);
var TEXTCOL = color(20, 20, 20);
var TOOLBAR = color(235, 235, 235, 240);
var MESSAGEBLUE = color(20, 60, 160);

var sansFont = createFont("sans", 15);
var serifFont = createFont("serif", 16);

var MAX_NODES = 250;
var ANIMATE_AVERAGE = 30;

var backgroundLight = 0.1;
var lightVector = { x: 0.5, y: -0.2, z: -2 };

var nodeSize = 10;
var persp = 1200;
var selected = false;

var translateX = width / 2;
var translateY = height / 2;

var toolbarWidth = 135;
var toolbarHeight = 0;
var toolbarX = width * 0.01;
var toolbarY = width * 0.01;
var toolbar;

var showing = {
    'Control points': true,
    'Control arms': true,
    //'Average points': true,
    Edges: true,
    Fill: true,
    Grid: true,
};

var messages = "intro";

/*************************************
 *      Linear algebra
**************************************/

var normaliseVector = function(v) {
    var d = sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    return { x: v.x / d, y: v.y / d, z: v.z / d};
};

var subtractVectors = function(v1, v2){
    return {
        x: v1.x - v2.x,
        y: v1.y - v2.y,
        z: v1.z - v2.z
    };
};

// Given at least 3 nodes, find the normal to the plane they define
// Only the first 3 nodes are used.
var normalOfPlane = function(nodes) {
    var v1 = {
        x: nodes[0].px - nodes[1].px,
        y: nodes[0].py - nodes[1].py,
        z: nodes[0].z - nodes[1].z
    };
    var v2 = {
        x: nodes[0].px - nodes[2].px,
        y: nodes[0].py - nodes[2].py,
        z: nodes[0].z - nodes[2].z
    };
    
    return {
        x: v1.y * v2.z - v1.z * v2.y,
        y: v1.z * v2.x - v1.x * v2.z,
        z: v1.x * v2.y - v1.y * v2.x
    };
};

var normalOfPlane2 = function(nodes) {
    var v1 = {
        x: nodes[0].x - nodes[1].x,
        y: nodes[0].y - nodes[1].y,
        z: nodes[0].z - nodes[1].z
    };
    var v2 = {
        x: nodes[0].x - nodes[2].x,
        y: nodes[0].y - nodes[2].y,
        z: nodes[0].z - nodes[2].z
    };
    
    return {
        x: v1.y * v2.z - v1.z * v2.y,
        y: v1.z * v2.x - v1.x * v2.z,
        z: v1.x * v2.y - v1.y * v2.x
    };
};

// Assume everything has 3 dimensions
var dotProduct = function(v1, v2){
    return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
};

var invertMatrix = function(m) {
    var A = m[1][1] * m[2][2] - m[2][1] * m[1][2];
    var B = m[1][2] * m[2][0] - m[1][0] * m[2][2];
    var C = m[1][0] * m[2][1] - m[1][1] * m[2][0];
    var idet = 1 / (m[0][0] * A + m[0][1] * B + m[0][2] * C);
    
    return [
        [A * idet, (m[0][2] * m[2][1] - m[0][1] * m[2][2]) * idet,
                   (m[0][1] * m[1][2] - m[0][2] * m[1][1]) * idet],
        [B * idet, (m[0][0] * m[2][2] - m[0][2] * m[2][0]) * idet,
                   (m[1][0] * m[0][2] - m[0][0] * m[1][2]) * idet],
        [C * idet, (m[2][0] * m[0][1] - m[0][0] * m[2][1]) * idet,
                   (m[0][0] * m[1][1] - m[1][0] * m[0][1]) * idet]
        ];
};

var multiplyMatrices = function(m1, m2) {
    var newMatrix = [];

    for (var i = 0; i < 3; i++) {
        var row = [];
        
        for (var j = 0; j < 3; j++) {
            var v = 0;
            
            for (var k = 0; k < 3; k++) {
                v += m1[i][k] * m2[k][j];
            }
            
            row.push(v);
        }
        
        newMatrix.push(row);
    }
    
    return newMatrix;
};

var applyMatrixToNodes = function(m, nodes) {
    for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        var x = n.x;
        var y = n.y;
        var z = n.z;
        n.x = m[0][0] * x + m[0][1] * y + m[0][2] * z;
        n.y = m[1][0] * x + m[1][1] * y + m[1][2] * z;
        n.z = m[2][0] * x + m[2][1] * y + m[2][2] * z;
    }
};

/*************************************
 *      Rotate functions
**************************************/

// Rotate shape around the z-axis
var rotateZ3D = function(theta, nodes) {
    var st = sin(theta);
    var ct = cos(theta);
    var x, y;
    
    for (var i = 0; i < nodes.length; i++) {
        x = nodes[i].x;
        y = nodes[i].y;
        nodes[i].x = ct * x - st * y;
        nodes[i].y = ct * y + st * x;
    }
};

var rotateY3D = function(theta, nodes) {
    var ct = cos(theta);
    var st = sin(theta);
    var x, z;

    for (var i = 0; i < nodes.length; i++) {
        x = nodes[i].x;
        z = nodes[i].z;
        nodes[i].x =  ct * x + st * z;
        nodes[i].z = -st * x + ct * z;
    }
};

var rotateX3D = function(theta, nodes){
    var ct = cos(theta);
    var st = sin(theta);
    var y, z;
    
    for (var i = 0; i < nodes.length; i++) {
        y = nodes[i].y;
        z = nodes[i].z;
        nodes[i].y = ct * y - st * z;
        nodes[i].z = st * y + ct * z;
    }
};

var getRotateXMatrix = function(theta) {
    var c = cos(theta);
    var s = sin(theta);
    return [[1, 0, 0], [0, c, -s], [0, s, c]];
};

var getRotateYMatrix = function(theta) {
    var c = cos(theta);
    var s = sin(theta);
    return [[c, 0, s], [0, 1, 0], [-s, 0, c]];
};

var sortByZ = function(a, b) {
    //return b.getZ() - a.getZ();
    return b.z - a.z;
};

// Return "n1,n2", where n1 < n2
var getID = function(n1, n2) {
    if (n1 < n2) {
        return n1 + "," + n2;
    }
    return n2 + "," + n1;
};

/*************************************
 * GUI Slider to vary parameters
**************************************/

var Slider = function(x, y, width, min_v, max_v, current_v, name) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.h = 12;
    this.held = false;
    this.name = name;
    
    this.ballR = 8;
    this.ballD = this.ballR * 2;
    
    this.min = min_v;
    this.max = max_v;
    this.scale = (max_v - min_v) / width;
    this.val = current_v || min_v;
    this.bx = this.x + (this.val - min_v) / this.scale;
    
    this.held = false;
};

Slider.prototype.draw = function() {
    if (this.name) {
        fill(TEXTCOL);
        textSize(15);
        textAlign(CENTER, BASELINE);
        text(this.name + ": " + this.val,  this.x + this.width / 2, this.y - 13);
    }
    
    noStroke();
    fill(180);
    rect(this.x-8, this.y - this.h/2, this.width + 16, this.h, 8);

    strokeWeight(1);
    stroke(0, 0, 0, 120);
    fill(180, 180, 250);
    ellipse(this.bx, this.y, this.ballD, this.ballD);
    noStroke();
    fill(255, 255, 255, 150);
    ellipse(this.bx - this.ballR * 0.3, this.y - this.ballR * 0.3, 5, 5);

};

Slider.prototype.selected = function() {
    this.held = dist(mouseX, mouseY, this.bx, this.y) < this.ballR;
};

Slider.prototype.drag = function() {
    if (this.held) {
        var x = constrain(mouseX, this.x, this.x + this.width);
        this.bx = x;
        this.val = this.min + round((x - this.x) * this.scale);
        return true;
    }
};

// This is used if you want to update
// the value in a way other
// than using the slider (but want the
// slider to update).
Slider.prototype.update = function(d) {
    this.val = constrain(this.val + d, this.min, this.max);
    this.bx = (this.val - this.min) / this.scale + this.x;
};

/*************************************
 *  GUI Button
**************************************/
{
var Button = function(x, y, w, h, name, clickFunction) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.name = name;
    this.defaultCol = TOOLBAR;
    this.highlightCol = color(210, 210, 210, 250);
    this.showing = true;
    this.box = this.h - 6;
    this.clickFunction = clickFunction;
    this.transition = 0;
};

Button.prototype.mouseOver = function() {
    return (mouseX >= this.x && mouseX <= this.x + this.w &&
            mouseY >= this.y && mouseY <= this.y + this.h);
};

Button.prototype.click = function() {
    if (this.clickFunction) {
        this.clickFunction();
    }
};

Button.prototype.draw = function() {
    if (!this.showing) { return; }
    
    this.fade();
    
    if (this.deactivated) {
        fill(200);
        noStroke();
    } else {
        fill(lerpColor(this.defaultCol, this.highlightCol, this.transition / 10));
        strokeWeight(1);
        stroke(200);
    }
    
    rect(this.x, this.y - 1, this.w, this.h + 3, 12);
    
    if (this.deactivated) {
        fill(120);
    } else {
        fill(TEXTCOL);
    }
    
    textFont(sansFont, 15);
    textAlign(CENTER, CENTER);
    text(this.name, this.x + this.w / 2, this.y + this.h/2 + 1);
};

Button.prototype.fade = function() {
    if (this.mouseOver() || this.selected) {
        this.transition = min(10, this.transition + 1);
    } else {
        this.transition = max(0, this.transition - 1);
    }
};

var CheckBox = function(x, y, w, h, name) {
    Button.call(this, x, y, w, h, name);
    this.box = this.h - 6;
    this.bx = this.x + 5;
    this.by = this.y + 3;
};
CheckBox.prototype = Object.create(Button.prototype);

CheckBox.prototype.click = function() {
    showing[this.name] = !showing[this.name];  
};

CheckBox.prototype.draw = function() {
    if (!this.showing) { return; }
    
    this.fade();
    
    if (this.transition) {
        noStroke();
        fill(lerpColor(this.defaultCol, this.highlightCol, this.transition / 10));
        rect(this.x, this.y, this.w, this.h + 1, 4);
    }
    
    fill(TEXTCOL);
    textFont(sansFont, 15);
    textAlign(LEFT, CENTER);
    text(this.name, this.x + this.box + 9, this.y + this.h/2 + 1);
    
    noFill();
    stroke(10);
    strokeWeight(1);
    rect(this.bx, this.y + 3, this.box, this.box);
    
    if (showing[this.name]) {
        line(this.bx + 1, this.by + 1, this.bx + this.box, this.by + this.box);
        line(this.bx + this.box, this.by + 1, this.bx + 1, this.by + this.box);
    }
};
}
/*************************************
 *      Number scrubber object
 * Shows a number with up and down
 * arrow buttons to change the value
**************************************/

var Scrubber = function(x, y, w, h, nowValue, values, updateF) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    
    this.index = nowValue;
    if (Array.isArray(values)) {
        this.mapping = values;
        this.value = this.mapping[this.index];
        this.maxValue = this.mapping.length;
    } else {
        this.maxValue = values;
        this.value = this.index;
    }
    
    this.updateFunction = updateF;
    this.selected = false;
};

Scrubber.prototype.draw = function(x, y) {
    if (x) { this.x = x; }
    if (y) { this.y = y; }
    
    // Box
    var d = 16;
    stroke(200);
    fill(BACKGROUND);
    strokeWeight(1);
    rect(this.x + d - 1, this.y - 1, this.w - d * 2, this.h + 1, 8);
    
    // Text
    textSize(15);
    textAlign(CENTER, CENTER);
    fill(TEXTCOL);
    
    var ty = this.y + this.h / 2;
    text("" + this.value, this.x + this.w / 2, ty);
    
    // Arrow buttons
    var mouseover = this.mouseOver();
    fill(ORANGE);
    if (this.selected === 1 || mouseover === 1) {
        //fill(200);
        stroke(160);
    } else {
        noStroke();
    }
    
    triangle(this.x + 3, ty,
             this.x + d - 2, this.y + 1,
             this.x + d - 2, this.y + this.h - 1);
    
    if (this.selected === 2 || mouseover === 2) {
        //fill(200);
        stroke(160);
    } else {
        //fill(ORANGE);
        noStroke();
    }
    
    triangle(this.x + this.w - 3, ty,
             this.x + this.w - d + 2, this.y + 1,
             this.x + this.w - d + 2, this.y + this.h -1);
};

Scrubber.prototype.updateValue = function() {
    if (this.selected === 1) {
        this.index = (this.index - 1 + this.maxValue) % this.maxValue;
    } else if (this.selected === 2) {
        this.index = (this.index + 1) % this.maxValue;
    }

    this.mapValue();
    this.update();
};

Scrubber.prototype.mapValue = function() {
    if (this.mapping) {
        this.value = this.mapping[this.index];
    } else {
        this.value = this.index;
    }
};

Scrubber.prototype.setValue = function(n) {
    this.value = n;
    if (this.mapping) {
        this.index = this.mapping.indexOf(this.value);
    } else {
        this.index = this.value;
    }
};

// Return 1 or 2 if mouse over top or bottom
// arrow respectively. Otherwise return null
Scrubber.prototype.mouseOver = function() {
    if (mouseY >= this.y && mouseY <= this.y + this.h) {
        if (mouseX >= this.x && mouseX <= this.x + 16) {
            return 1;
        } else if (mouseX >= this.x + this.w - 16 && mouseX <= this.x + this.w) {
            return 2;
        }
    }
};

Scrubber.prototype.mousePressed = function() {
    this.selected = this.mouseOver();
};

Scrubber.prototype.mouseReleased = function() {
    if (this.selected) {
        this.updateValue();
        this.selected = false;
    }
};

Scrubber.prototype.click = function() {
    this.selected = this.mouseOver();
    this.updateValue();
};

Scrubber.prototype.update = function() {
    if (this.updateFunction) {
        this.updateFunction(this.index);
    }
};

/**************************************
 *      Toolbar
 *  Contains other GUI elements
***************************************/

var Toolbar = function(x, y, w) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = 4;
    
    this.buttons = [];
    this.sliders = [];
};

Toolbar.prototype.draw = function() {
    noStroke();
    fill(230, 230, 230, 200);
    rect(this.x, this.y, this.w, this.h, 8);
   
    for (var i = 0; i < this.buttons.length; i++) {
        this.buttons[i].draw();
    }
    
    for (var i = 0; i < this.sliders.length; i++) {
        this.sliders[i].draw();
    }
};

Toolbar.prototype.addButton = function(name, func) {
    var h = 18;
    var x = this.x + 5;
    var y = this.y + this.h;
    var w = this.w - 10;
    
    
    this.buttons.push(new Button(x, y, w, h, name, func));
    this.h += h + 8;
};

Toolbar.prototype.addScrubber = function(nowValue, values, updateF) {
    var h = 20;
    var x = this.x + 5;
    var y = this.y + this.h + 3;
    var w = this.w - 10;
    
    this.buttons.push(new Scrubber(x, y, w, h, nowValue, values, updateF));
    this.h += h + 10;
};

Toolbar.prototype.addOptions = function(options) {
    var x = this.x + 3;
    var y = this.y + this.h + 2;
    var w = this.w - 6;
    var h = 22;
    
    for (var opt in options) {
        this.buttons.push(new CheckBox(x, y, w, h, opt));
        y += h + 5;
        this.h += h + 5;
    }
    
    this.h += 2;
};

Toolbar.prototype.mousePressed = function() {
    for (var i = 0; i < this.buttons.length; i++) {
        if (this.buttons[i].mouseOver()) {
            this.buttons[i].selected = true;
        }
    }
    
    for (var i = 0; i < this.sliders.length; i++) {
        this.sliders[i].selected();
    }
};

Toolbar.prototype.mouseReleased = function() {
    for (var i = 0; i < this.buttons.length; i++) {
        var button = this.buttons[i];
        if (button.selected && button.mouseOver()) {
            button.click();
        }
        button.selected = false;
    }
    for (var i = 0; i < this.sliders.length; i++) {
        this.sliders[i].held = false;
    }
};

Toolbar.prototype.mouseDragged = function() {
    for (var i = 0; i < this.sliders.length; i++) {
        if (this.sliders[i].drag()) {
            return true;
        }
    }
};

/********************************************************
 *      Node object
 * A node is an point in 3D space
*********************************************************/

var Node = function(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.r = nodeSize;
    this.color = ORANGE;
    this.update();
};

Node.prototype.draw = function() {
    fill(this.color);
    noStroke();
    ellipse(this.px, this.py, this.r, this.r);
};

Node.prototype.update = function() {
    var p = persp / (this.z + persp);
    this.px = this.x * p;
    this.py = this.y * p;
};

Node.prototype.getZ = function() {
    return this.z;
};

Node.prototype.info = function() {
    println(this.x  + " " + this.y + " " + this.z);
};

/********************************************************
 *      Edge object
 *  An edge is a line that join two nodes.
*********************************************************/

var Edge = function(node1, node2, color, thickness) {
    this.node1 = node1;
    this.node2 = node2;
    this.update();
    this.color = color || BLUE;
    this.thickness = thickness || 1;
};

Edge.prototype.draw = function() {
    stroke(this.color);
    strokeWeight(this.thickness);
    line(this.x1, this.y1, this.x2, this.y2);
};

Edge.prototype.update = function() {
    // var dx = this.node1.x - this.node2.x;
    // var dy = this.node1.y - this.node2.y;
    // var theta = atan2(dx, dy);

    this.x1 = this.node1.px;// - 0.5 * nodeSize * sin(theta);
    this.y1 = this.node1.py;// - 0.5 * nodeSize * cos(theta);
    this.x2 = this.node2.px;// + 0.5 * nodeSize * sin(theta);
    this.y2 = this.node2.py;// + 0.5 * nodeSize * cos(theta);
    
    this.z = 0.5 * (this.node1.z + this.node2.z) - this.thickness / 8;
};

Edge.prototype.getZ = function() {
    return 0.5 * (this.node1.z + this.node2.z) - this.thickness / 10;
};

/*************************************
 *      Face object
 * A face is a surface that joins an
 * array of nodes.
 * Its colour depends on its
 * orientation relative to a light
 * source.
**************************************/

var Face = function(nodes, color) {
    this.nodes = nodes;
    this.update();
    this.color = color || GREEN;
    this.light = this.color;
    this.sort = 0;
    
    if (this.nodes.length === 3) {
        this.drawShape = this.drawTriangle;
    } else {
        this.drawShape = this.drawQuad;
    }
};

Face.prototype.update = function() {
    var normal = normaliseVector(normalOfPlane(this.nodes));
    var l = 1 - constrain(dotProduct(lightVector, normal), 0.1, 1);
    this.light = lerpColor(this.color, SHADE, l);
    
    // Find order in which to draw faces
    // by finding where it intersects the z-axis
    
    if (normal.z < 0) {
        //this.z = dotProduct(normal, this.nodes[0]) / normal.z;
        
        this.z = 0;
        var n = this.nodes.length;
        for (var i = 0; i < n; i++) {
            this.z += this.nodes[i].z;
        }
        this.z /= n;
    } else {
        this.z = null;
    }
    
};

Face.prototype.info = function() {
    println("Face (" + this.nodes.length + ")");
    for (var i = 0; i < this.nodes.length; i++) {
        this.nodes[i].info();
    }
};

Face.prototype.draw = function() {
    strokeWeight(1);
    fill(this.light);
    stroke(this.light);
    this.drawShape();
};

Face.prototype.drawTriangle = function() {
    triangle(this.nodes[0].px, this.nodes[0].py,
             this.nodes[1].px, this.nodes[1].py,
             this.nodes[2].px, this.nodes[2].py);
};

Face.prototype.drawQuad = function() {
    quad(this.nodes[0].px, this.nodes[0].py,
         this.nodes[1].px, this.nodes[1].py,
         this.nodes[2].px, this.nodes[2].py,
         this.nodes[3].px, this.nodes[3].py);
};

/*************************************
 *      Average Point object
 * A point whose position is defined
 * as the weighted
 * average of a list of points.
**************************************/

var AveragePoint = function(points, weights, n) {
    this.color = GREEN;
    this.points = points;
    this.weights = weights;
    this.r = 8;
    this.n = n; // Index in node array
    this.animation = 0;
    
    this.update();
};

AveragePoint.prototype.draw = function() {
    strokeWeight(1);
    stroke(BACKGROUND);
    fill(this.color);
    ellipse(this.px, this.py, this.r, this.r);
};

AveragePoint.prototype.update = function(animation) {
    this.x = 0;
    this.y = 0;
    this.z = 0;
    var w, p;
    
    for (var i in this.weights) {
        w = this.weights[i];
        p = this.points[i];
        this.x += p.x * w;
        this.y += p.y * w;
        this.z += p.z * w;
    }
    
    if (animation) {
        var x = 0;
        var y = 0;
        var z = 0;
        
        for (var i in this.newWeights) {
            w = this.newWeights[i];
            p = this.points[i];
            x += p.x * w;
            y += p.y * w;
            z += p.z * w;
        }
        
        this.x = lerp(x, this.x, animation / ANIMATE_AVERAGE);
        this.y = lerp(y, this.y, animation / ANIMATE_AVERAGE);
        this.z = lerp(z, this.z, animation / ANIMATE_AVERAGE);
    }
    
    var p = persp / (this.z + persp);
    this.px = this.x * p;
    this.py = this.y * p;
};

AveragePoint.prototype.getZ = function() {
    // Ensure these are drawn behind the main nodes
    return this.z + 0.01;
};

AveragePoint.prototype.info = function() {
    println("Point (" + this.x + ", " + this.y +  ", " + this.z + ")");
    for (var i in this.weights) {
        println(this.weights[i] + " * node " + i + " (" + this.points[i].x + ", " + this.points[i].y + ")");
    }
};

// Given an array of AveragePoints, return a hash
// of their weight averaged
var getAverageOfWeights = function(points) {
    var d = { };
    var w = 1 / points.length;
    
    for (var i = 0; i < points.length; i++) {
        var p = points[i];
        for (var j in p.weights) {
            if (d[j]) {
                d[j] += p.weights[j] * w;
            } else {
                d[j] = p.weights[j] * w;  
            }
        }   
    }
    
    return d;
};

// Given an array of AveragePoints,
// return a new averagePoint, which is their average
var getAverageOfPoints = function(points, n) {
    var d = getAverageOfWeights(points);

    return new AveragePoint(points[0].points, d, n);
};

/*************************************
 *      Wireframe object
**************************************/

var Wireframe = function(shapes) {
    this.shapes = shapes;
    this.index = 0;
    this.init();
};

Wireframe.prototype.init = function() {
    this.originalNodes = this.shapes[this.index].nodes;
    this.originalFaces = this.shapes[this.index].faces;
    this.selectedNode = false;
    this.animation = 0;
    this.reset();
};

Wireframe.prototype.reset = function() {
    // Create Wireframe control points
    this.nodes = [];
    
    for (var i = 0; i < this.originalNodes.length; i++) {
        var n = this.originalNodes[i];
        this.nodes.push(new Node(n[0], n[1], n[2]));
    }
    
    this.matrix = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    this.rotateX = 0;
    this.rotateY = 0;
    
    this.undivide();
};

Wireframe.prototype.swapShape = function(value) {
    this.index = value % this.shapes.length;
    this.init();
};

// Get shape in its undivided form
Wireframe.prototype.undivide = function() {
    // Add average points at each node
    this.averageNodes = [];
    for (var i = 0; i < this.nodes.length; i++) {
        var d = {};
        d[i] = 1;
        this.averageNodes.push(new AveragePoint(this.nodes, d, i));
    }

    this.faceNums = this.originalFaces;
    this.createFaces();

    this.edges = [];
    this.averageEdges = [];
    
    // Keep track of which edges we have created
    var edgeIDs = [];
    
    for (var i = 0; i < this.originalFaces.length; i++) {
        var face = this.originalFaces[i];
        var n = face.length;
        
        for (var j = 0; j < n; j++) {
            var n1 = face[j];
            var n2 = face[(j + 1) % n];
            var id = getID(n1, n2);
            
            if (edgeIDs.indexOf(id) === -1) {
                this.edges.push(
                    new Edge(this.nodes[n1], this.nodes[n2])
                );
                this.averageEdges.push(
                    new Edge(this.averageNodes[n1],
                             this.averageNodes[n2], GREEN, 2)
                );
                edgeIDs.push(id);
            }
            
        }
    }

    this.collectParts();
    
    if (toolbar && toolbar.buttons) {
        toolbar.buttons[1].deactivated = false;
        toolbar.buttons[3].deactivated = false;
    }
};

// Convert an array of arrays of node indices into an
// array of face objects from those nodes
Wireframe.prototype.createFaces = function() {
    this.faces = [];
    for (var i = 0; i < this.faceNums.length; i++) {
        var nodeNums = this.faceNums[i];
        var nodes = [];
        for (var j = 0; j < nodeNums.length; j++) {
            nodes.push(this.averageNodes[nodeNums[j]]);
        }
        this.faces.push(new Face(nodes));
        
    }
};

// Collect everything together so we can sort and draw
Wireframe.prototype.collectParts = function() {
    this.parts = [];
    
    if (showing['Control points']) {
        this.parts = this.parts.concat(this.nodes);
    }
    if (showing['Control arms']) {
        this.parts = this.parts.concat(this.edges);
    }
    if (showing['Average points']) {
        this.parts = this.parts.concat(this.averageNodes);
    }
    if (showing.Fill) {
        this.parts = this.parts.concat(this.faces);
    }
    if (showing.Edges) {
        this.parts = this.parts.concat(this.averageEdges);
    }
    this.parts.sort(sortByZ);
    this.update();
};

Wireframe.prototype.draw = function() {
    if (this.animation > 0) {
        this.animation--;
        
        if (this.animation === 0) {
            for (var i = 0; i < this.averageNodes.length; i++) {
                this.averageNodes[i].weights = this.averageNodes[i].newWeights;
            }
        }
        
        this.update();
    }
    
    var n = this.parts.length;
    for (var i = 0; i < n; i++) {
        if (this.parts[i].z !== null) {
            this.parts[i].draw();   
        }
    }
};

Wireframe.prototype.update = function() {
    for (var i = 0; i < this.nodes.length; i++) {
        this.nodes[i].update();
    }

    for (var i = 0; i < this.edges.length; i++) {
        this.edges[i].update();
    }
    
    for (var i = 0; i < this.averageNodes.length; i++) {
        this.averageNodes[i].update(this.animation);
    }
    
    for (var i = 0; i < this.averageEdges.length; i++) {
        this.averageEdges[i].update();
    }
    
    for (var i = 0; i < this.faces.length; i++) {
        this.faces[i].update();
    }
    
    this.parts.sort(sortByZ);
};

// Create new average points along each face and each edge
Wireframe.prototype.split = function() {
    var n = this.averageNodes.length;
    
    if (n > MAX_NODES) {
        toolbar.buttons[1].deactivated = true;
        toolbar.buttons[3].deactivated = true;
        return;
    }
    
    // Add nodes halfway along each edge
    var newEdges = [];
    var nodeOfEdge = {};
    
    for (var i = 0; i < this.averageEdges.length; i++) {
        var node1 = this.averageEdges[i].node1;
        var node2 = this.averageEdges[i].node2;
        var newNode = getAverageOfPoints([node1, node2], n + i);
        
        this.averageNodes.push(newNode);
        newEdges.push(new Edge(node1, newNode, GREEN, 2));
        newEdges.push(new Edge(node2, newNode, GREEN, 2));
        
        // Record which two nodes this new node is between
        // nodeOfEdge['2,4'] = node
        // means this node is between node 2 and 4
        nodeOfEdge[getID(node1.n, node2.n)] = newNode;
    }
    
    n = this.averageNodes.length;
    
    // Add new nodes in the center of each face
    var newFaces = [];
    for (var i = 0; i < this.faceNums.length; i++) {
        var face = this.faceNums[i];
        var nodeInFace = face.length;
        
        // Get the nodes on the midpoint of each edge
        var edgeNodes = [];
        for (var j = 0; j < nodeInFace; j++) {
            var id = getID(face[j], face[(j + 1) % nodeInFace]);
            edgeNodes.push(nodeOfEdge[id]);
        }
        
        // Create new node, which is the average of the midpoints
        var centerNode = getAverageOfPoints(edgeNodes, n + i);
        this.averageNodes.push(centerNode);
        
        // Create four new edges
        for (var j = 0; j < edgeNodes.length; j++) {
            newEdges.push(new Edge(centerNode, edgeNodes[j], GREEN, 2));
        }
        
        // Create four new faces
        for (var j = 0; j < nodeInFace; j++) {
            var n1 = face[j];
            var n2 = edgeNodes[j].n;
            var n3 = edgeNodes[(j + nodeInFace - 1) % nodeInFace].n;
            newFaces.push([n1, n2, n + i, n3]);
        }
    }

    this.averageEdges = newEdges;
    this.faceNums = newFaces;
    this.createFaces();
    this.collectParts();
    this.update();
};

// Each point becomes an average of its neighbours
Wireframe.prototype.average = function() {
    var n = this.averageNodes.length;
    
    // Create an array for each node
    var edgesOfNode = [];
    for (var i = 0; i < n; i++) {
        edgesOfNode.push([]);
    }
    
    // Go through each each edge add pairs of nodes
    for (var i = 0; i < this.averageEdges.length; i++) {
        var n1 = this.averageEdges[i].node1;
        var n2 = this.averageEdges[i].node2;
        edgesOfNode[n1.n].push(n2);
        edgesOfNode[n2.n].push(n1);
    }
    
    // Each node is averaged with itself and its neighbours
    for (var i = 0; i < n; i++) {
        this.averageNodes[i].newWeights = getAverageOfWeights(edgesOfNode[i]);
    }
    this.animation = ANIMATE_AVERAGE;
        
    this.collectParts();
    this.update();
};

Wireframe.prototype.rotate = function() {
    // Matrix to reset current camera position
    var inv = invertMatrix(this.matrix);
    
    // Matrix for new rotation
    this.matrix = multiplyMatrices(getRotateXMatrix(this.rotateY), getRotateYMatrix(this.rotateX));
    
    // Apply both matrixes
    applyMatrixToNodes(multiplyMatrices(this.matrix, inv), this.nodes);
};

Wireframe.prototype.mousePressed = function() {
    var mx = mouseX - translateX;
    var my = mouseY - translateY;
    
    if (showing['Control points']) {
        for (var n = 0; n < this.nodes.length; n++) {
            var node = this.nodes[n];
            if (dist(mx, my, node.px, node.py) <= nodeSize * 0.5) {
                this.selectedNode = node;
                break;
            }
        }   
    }
};

Wireframe.prototype.mouseDragged = function() {
    var dx = mouseX - pmouseX;
    var dy = mouseY - pmouseY;
        
    if (this.selectedNode !== false) {
        this.selectedNode.x += dx;
        this.selectedNode.y += dy;
        this.update();
        if (messages === 'move') {
            messages = 'subdivide';
        }
        return false;
    } else {
        var d = 0.4;
        this.rotateX -= d * dx;
        this.rotateY += d * dy;
        this.rotate();
    }
    
    this.update();
    return true;
};

Wireframe.prototype.mouseReleased = function() {
    this.selectedNode = false;
};

/*************************************
 *      Grid objects
 * a grid in the xz plane with n squares in each direction
 * size is the size of each square
**************************************/

var Grid = function(n, size, y) {
    this.n = n;
    this.size = size;
    this.y = y || 0;
    this.reset();
};

Grid.prototype.reset = function() {
    this.nodes = [];
    this.edges = [];
    
   for (var i = 0; i <= this.n; i++) {
        var x = (i - this.n / 2) * this.size;
        for (var j = 0; j <= this.n; j++) {
            var z = (j - this.n / 2) * this.size;
            this.nodes.push({ x: x, y: this.y, z: z});
            
            var p = j * (this.n + 1) + i;
            if (i > 0) {
                this.edges.push([p, p - 1]);
            }
            if (j > 0) {
                this.edges.push([p, p - this.n - 1]);
            }
        }
    }
    
    this.corners = [
        this.nodes[0],
        this.nodes[this.n],
        this.nodes[(this.n + 1) * (this.n + 1) - 1],
        this.nodes[(this.n + 1) * this.n]
    ];
    
    this.matrix = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    this.rotateX = 0;
    this.rotateY = 0;
};

Grid.prototype.draw = function() {
    noStroke();
    fill(0, 0, 255, 20);
    quad(this.corners[0].px, this.corners[0].py,
         this.corners[1].px, this.corners[1].py,
         this.corners[2].px, this.corners[2].py,
         this.corners[3].px, this.corners[3].py);
    
    
    strokeWeight(1);
    stroke(80, 80, 40, 60);
    
    for (var i = 0; i < this.edges.length; i++) {
        var edge = this.edges[i];
        var n1 = this.nodes[edge[0]];
        var n2 = this.nodes[edge[1]];
        var p1 = n1.z + persp;
        var p2 = n2.z + persp;
        if (p1 > 0 && p2 > 0) {
            p1 = persp / p1;
            p2 = persp / p2;
            line(n1.x * p1, n1.y * p1, n2.x * p2, n2.y * p2);   
        }
    }
};

Grid.prototype.orientation = function() {
    for (var i = 0; i < this.corners.length; i++) {
        var p = persp / (this.corners[i].z + persp);
        this.corners[i].px = this.corners[i].x * p;
        this.corners[i].py = this.corners[i].y * p;
    }
    
    return normalOfPlane(this.corners);
};

Grid.prototype.rotate = function() {
    // Matrix  to reset current camera position
    var inv = invertMatrix(this.matrix);
    
    // Matrix for new rotation
    this.matrix = multiplyMatrices(getRotateXMatrix(this.rotateY), getRotateYMatrix(this.rotateX));
    
    // Apply both matrixes
    applyMatrixToNodes(multiplyMatrices(this.matrix, inv), this.nodes);
};

Grid.prototype.mouseDragged = function() {
    var d = 0.4;
    var dx = d * (mouseX - pmouseX);
    var dy = d * (mouseY - pmouseY);
    this.rotateX -= dx;
    this.rotateY += dy;
    this.rotate();
};

/*************************************
 *      Create wireframe objects
**************************************/

var createCuboid = function(x, y, z, w, h, d) {
    var nodes = [
        [x, y, z],
        [x, y, z + d],
        [x, y + h, z],
        [x, y + h, z + d],
        [x + w, y, z],
        [x + w, y, z + d],
        [x + w, y + h, z],
        [x + w, y + h, z + d]
    ];

    var faces= [
        [0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1],
        [0, 2, 6, 4], [1, 5, 7, 3], [2, 3, 7, 6]
    ];

    return { 'nodes': nodes, 'faces': faces };
};

var createSquareTorus = function(x, y, z, d, r) {
    var d2 = d / 2;
    var r2 = r / 2;
    
    var nodes = [
        [x - r2,     y - r2 - d, z - d2],
        [x + r2,     y - r2 - d, z - d2],
        [x - r2 - d, y - r2,     z - d2],
        [x - r2,     y - r2,     z - d2],
        [x + r2,     y - r2,     z - d2],
        [x + r2 + d, y - r2,     z - d2],
        [x - r2 - d, y + r2,     z - d2],
        [x - r2,     y + r2,     z - d2],
        [x + r2,     y + r2,     z - d2],
        [x + r2 + d, y + r2,     z - d2],
        [x - r2,     y + r2 + d, z - d2],
        [x + r2,     y + r2 + d, z - d2],
        
        [x - r2,     y - r2 - d, z + d2],
        [x + r2,     y - r2 - d, z + d2],
        [x - r2 - d, y - r2,     z + d2],
        [x - r2,     y - r2,     z + d2],
        [x + r2,     y - r2,     z + d2],
        [x + r2 + d, y - r2,     z + d2],
        [x - r2 - d, y + r2,     z + d2],
        [x - r2,     y + r2,     z + d2],
        [x + r2,     y + r2,     z + d2],
        [x + r2 + d, y + r2,     z + d2],
        [x - r2,     y + r2 + d, z + d2],
        [x + r2,     y + r2 + d, z + d2]
    ];
    
    var faces= [
        // Top faces top
        [0, 2, 3], [0, 3, 4, 1], [1, 4, 5],
        // Top faces sides
        [2, 6, 7, 3], [4, 8, 9, 5],
        // Top faces bottom
        [6, 10, 7], [7, 10, 11, 8], [8, 11, 9],
        // Lower faces top
        [12, 15, 14], [12, 13, 16, 15], [13, 17, 16],
        // Lower faces sides
        [14, 15, 19, 18], [16, 17, 21, 20],
        // Lower faces bottom
        [18, 19, 22], [19, 20, 23, 22], [20, 21, 23],
    ];
    
    // Create edge faces
    // List of nodes around outer edge
    var edges = [0, 1, 5, 9, 11, 10, 6, 2];
    for (var i = 0; i < edges.length; i++) {
        var n1 = edges[i];
        var n2 = edges[(i + 1) % edges.length];
        faces.push([n1, n2, n2 + 12, n1 + 12]);
    }
    
    // Inner faces
    edges = [3, 7, 8, 4];
    for (var i = 0; i < edges.length; i++) {
        var n1 = edges[i];
        var n2 = edges[(i + 1) % edges.length];
        faces.push([n1, n2, n2 + 12, n1 + 12]);
    }

    return { 'nodes': nodes, 'faces': faces };
};

var createHand = function() {
    var nodes = [];
    var faces = [];
    
    var addFinger = function(d, dx, dz) {
        var n = nodes.length;
        var addJoin = n < 16;
        var x2 = d[1][0] - 230;
        var y2 = d[1][1] - 200;
        
        for (var i = 0; i < d.length; i++) {
            var x = d[i][0] - 230;
            var y = d[i][1] - 200;
            var z = d[i][2];
            var a = atan2(y2 - y, x2 - x) + 90;
            a = i ? a + 180 : a;
            var dx2 = dx * cos(a);
            var dy2 = dx * sin(a);
            
            // Don't add nodes for joins between fingers
            if (i > 0 || addJoin) {
                nodes.push([x - dx2, y - dy2, z - dz]);
                nodes.push([x - dx2, y - dy2, z + dz]);
            }
            
            nodes.push([x + dx2, y + dy2, z + dz]);
            nodes.push([x + dx2, y + dy2, z - dz]);
            
            x2 = x;
            y2 = y;
            dx--;
            dz--;
        }
        
        // Side faces
        if (!addJoin) { n -= 2; }
        
        for (var i = 0; i < d.length - 1; i++) {
            var n0 = n + i * 4;
            
            if (i === 0 && !addJoin) {
                var n0 = [n - 11, n - 12, n + 2, n + 3];
                var n1 = [n + 4, n + 5, n + 6, n + 7];
                
                for (var j = 0; j < 4; j++) {
                    faces.push([n0[j], n1[j], n1[(j + 1) % 4], n0[(j + 1) % 4]]);
                }

            } else {
            
                for (var j = 0; j < 4; j++) {
                    var n1 = n0 + j;
                    var n2 = n0 + (j + 1) % 4;
                    faces.push([n1, n1 + 4, n2 + 4, n2]);
                }
            }
        }
        
        // Tip/End face
        var n = nodes.length;
        faces.push([n - 1, n - 2, n - 3, n - 4]);
    };
    
    // Thumb
    addFinger([[165,195,5], [145,155,5], [131,121,0]], 14, 12);
    
    // Index finger
    addFinger([[200,140,10],[193,90,16],[188,52,10],[185,32,0]], 12, 9);
    
    // Middle finger
    addFinger([[228,138,10],[228,78,16],[228,37,10],[228,14,0]], 12, 9);
    
    // Ring finger
    addFinger([[254,142,10],[267,84,16],[276,50,10],[280,32,0]], 12, 9);
    
    // Little finger
    addFinger([[280,148,10],[294,114,16],[304,90,10],[310,74,0]], 11, 8);
    
    // Palm
    var n = nodes.length;
    nodes.push([0, -5, 20]);
    nodes.push([0, -5, -10]);
    nodes.push([50, 5, 20]);
    nodes.push([50, 5, -15]);
    nodes.push([-40, 60, 20]);
    nodes.push([-40, 60, -15]);
    nodes.push([30, 60, 20]);
    nodes.push([30, 60, -15]);
    
    faces.push([2, 13, 14, n]);
    faces.push([3, n + 1, 15, 12]);
    
    faces.push([14, 28, 42, n]);
    faces.push([15, n + 1, 43, 29]);
    faces.push([42, 56, n + 2, n]);
    faces.push([43, n + 1, n + 3, 57]);
    
    faces.push([1, 2, n, n + 4]);
    faces.push([0, n + 5, n + 1, 3]);
    
    faces.push([n, n + 2, n + 6, n + 4]);
    faces.push([n + 1, n + 5, n + 7, n + 3]);
    
    // Gaps between thumb and index finger
    faces.push([2, 3, 12, 13]);
    
    // More edges
    faces.push([0, 1, n + 4, n + 5]);
    faces.push([n + 4, n + 6, n + 7, n + 5]);
    faces.push([n + 2, n + 3, n + 7, n + 6]);
    faces.push([56, 57, n + 3, n + 2]);
    

    return { 'nodes': nodes, 'faces': faces };
};

//var cuboid = createCuboid(-100, -100, -100, 200, 200, 200);
var torus = createSquareTorus(0, -20, 0, 60, 120);
var cuboid = createCuboid(-100, -100, -100, 200, 200, 200);
var hand = createHand();

var myShape = new Wireframe([cuboid, torus, hand]);
var grid = new Grid(20, 80, 100);

var lightVector = normaliseVector(lightVector);

/*************************************
 *      GUI
**************************************/

var addButtons = function(toolbar) {
    var swapShape = function(value) {
        if (messages === 'intro') {
            messages = 'move';
        }
        myShape.swapShape(value);
        grid.reset();
    };
    
    toolbar.addScrubber(0, ["Cube", "Ring", "Hand"], swapShape);
    
    // Functions to attach to buttons
    var funcs = {
        "Split": function() {
            myShape.split();
        },
        "Average": function() {
            myShape.average();
        },
        "Subdivide": function() {
            if (!myShape.animation) {
                myShape.split();
                myShape.average();  
            }
            messages = "";
        },
        "Undivide": function() {
            myShape.undivide();
        },
        "Reset": function() {
            myShape.reset();
            grid.reset();
        }
    };

    for (var f in funcs) {
        toolbar.addButton(f, funcs[f]);
    }    
    
    toolbar.addOptions(showing);
};

toolbar = new Toolbar(toolbarX, toolbarX, toolbarWidth);
addButtons(toolbar);

/*************************************
 *      Draw functions
**************************************/

var drawArrow = function(x1, y1, x2, y2) {
    var angle = atan2(y2 - y1, x2 - x1);
    var d = dist(x1, y1, x2, y2) * 0.3;
    
    var cx1 = x1;
    var cy1 = y1;
    var cx2 = x2;
    var cy2 = y2;
    var angle2 = angle + 20;
    
    if (angle > 45 && angle < 135) {
        cx1 += d * cos(angle + 40);
        cy1 += d * sin(angle + 40);
        cx2 -= d * cos(angle - 40);
        cy2 -= d * sin(angle - 40);
        angle2 = angle - 40;
    } else {
        cx1 += d * cos(angle - 20);
        cy1 += d * sin(angle - 20);
        cx2 -= d * cos(angle + 20);
        cy2 -= d * sin(angle + 20);
    }
    
    //ellipse(cx1, cy1, 8, 8);ellipse(cx2, cy2, 8, 8);
    
    noFill();
    strokeWeight(3);
    stroke(MESSAGEBLUE);
    bezier(x1, y1, cx1, cy1, cx2, cy2, x2, y2);
    
    noStroke();
    fill(MESSAGEBLUE);
    pushMatrix();
    translate(x2, y2);
    rotate(angle2);
    triangle(8, 0, -5, 4, -5, -4);
    popMatrix();
};

var drawMessage = function() {
    textSize(15);
    textLeading(20);
    
    var message, x1, y1;
    
    if (messages === 'intro') {
        message = "Select a starting shape.";
        x1 = toolbar.x + toolbar.w - 2;
        y1 = toolbar.buttons[0].y + toolbar.buttons[0].h * 0.8;
    } else if (messages === 'move') {
        message = "Click and drag to move control points.";
        x1 = myShape.nodes[0].x + translateX - 16;
        y1 = myShape.nodes[0].y + translateY - 8;
    } else if (messages === 'subdivide') {
        message = "Subdivide the shape to make it smoother.";
        x1 = toolbar.x + toolbar.w - 2;
        y1 = toolbar.buttons[3].y + toolbar.buttons[3].h * 0.8;
    }
    
    if (!message) { return; }
    
    var w = textWidth(message) + 20;
    var h = 25;
    var x = toolbar.x + toolbar.w + 200;
    var y = 10;
    
    strokeWeight(3);
    stroke(MESSAGEBLUE);
    fill(255);
    rect(x - w / 2, y, w, h, 20);
    
    textAlign(CENTER, CENTER);
    fill(20);
    text(message, x, y + h / 2);
    drawArrow(x, y + h + 1, x1, y1);
};

/*************************************
 *      Main loop
**************************************/

var draw = function() {
    background(BACKGROUND);
    
    pushMatrix();
    translate(translateX, translateY);
    
    if (showing.Grid && grid.orientation().z > 0) {
        grid.draw();   
    }
    
    myShape.draw();
    
    if (showing.Grid && grid.orientation().z <= 0) {
        grid.draw();   
    }
    
    popMatrix();
    
    if (myShape.averageNodes.length > MAX_NODES) {
        toolbar.buttons[1].disabled = true;
        toolbar.buttons[2].disabled = true;
        toolbar.buttons[3].disabled = true;
    } else {
        toolbar.buttons[1].disabled = false;
        toolbar.buttons[2].disabled = false;
        toolbar.buttons[3].disabled = false;
    }
    
    toolbar.draw();
    //drawMessage();
};

/*************************************
 *      Event handling
**************************************/

mousePressed = function() {
    myShape.mousePressed();
    toolbar.mousePressed();
};

mouseDragged = function() {
    if (myShape.mouseDragged()) {
        grid.mouseDragged();   
    }
};

mouseReleased = function() {
    toolbar.mouseReleased();
    myShape.mouseReleased();
    myShape.collectParts();
};

mouseOut = function() {
    //mouseReleased();
};

keyPressed = function() {
    if (keyCode === LEFT) {
        rotateY3D(-3, myShape.nodes);
        rotateY3D(-3, grid.nodes);
    } else if (keyCode === RIGHT) {
        rotateY3D(3, myShape.nodes);
        rotateY3D(3, grid.nodes);
    } else if (keyCode === UP) {
        rotateX3D(3, myShape.nodes);
        rotateX3D(3, grid.nodes);
    } else if (keyCode === DOWN) {
        rotateX3D(-3, myShape.nodes);
        rotateX3D(-3, grid.nodes);
    }
    myShape.update();
};

//rotateY3D(30, myShape.nodes);
//rotateX3D(15, myShape.nodes);
//rotateY3D(30, grid.nodes);
//rotateX3D(15, grid.nodes);
myShape.update();
