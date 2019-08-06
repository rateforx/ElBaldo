import * as THREE from 'three/build/three.module';

window.THREE = THREE;

import { GUI } from 'dat.gui';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Water } from './Water';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls';

var scene;
var camera;
var renderer;
var water;
let gui;
let directionalLight;
let ambientLight;
let waterGeometry;
let finalComposer;
let finalPass;
let bloomComposer;
let renderScene;
let bloomPass;
let bloomLayer;

let ENTIRE_SCENE = 0;
let BLOOM_SCENE  = 1;

let params = {
    scale          : 1,
    flowX          : -.2,
    flowY          : .2,
    exposure       : .5,
    bloomThreshold : 0,
    bloomStrength  : 2.5,
    bloomRadius    : 0,
    controlsEnabled: false
};

let textureLoader;
let objectLoader;
let materials = {};
let darkMaterial;

init();
animate();

function init () {
    scene        = new THREE.Scene();
    window.scene = scene;
    // scene.background = new THREE.Color( 'red' );

    // loaders

    textureLoader = new THREE.TextureLoader();
    objectLoader  = new THREE.ObjectLoader();

    // camera

    camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 1000 );
    camera.position.set( -21.9, 1.52, -.48 );
    camera.rotation.set( -1.870, -1.537, -1.870 );
    // camera.lookAt( scene.position );

    // renderer

    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.toneMapping = THREE.ReinhardToneMapping;
    document.getElementById( 'three' ).appendChild( renderer.domElement );

    // shaders

    renderScene = new RenderPass( scene, camera );

    bloomLayer = new THREE.Layers();
    bloomLayer.set( BLOOM_SCENE );

    bloomPass           = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ), 1.5, 0.4, 0.85 );
    bloomPass.threshold = params.bloomThreshold;
    bloomPass.strength  = params.bloomStrength;
    bloomPass.radius    = params.bloomRadius;

    bloomComposer                = new EffectComposer( renderer );
    bloomComposer.renderToScreen = false;
    bloomComposer.addPass( renderScene );
    bloomComposer.addPass( bloomPass );

    finalPass           = new ShaderPass(
        new THREE.ShaderMaterial( {
            uniforms      : {
                baseTexture : { value: null },
                bloomTexture: { value: bloomComposer.renderTarget2.texture }
            },
            vertexShader  : document.getElementById( 'vertexshader' ).textContent,
            fragmentShader: document.getElementById( 'fragmentshader' ).textContent,
            defines       : {}
        } ), 'baseTexture'
    );
    finalPass.needsSwap = true;

    finalComposer = new EffectComposer( renderer );
    finalComposer.addPass( renderScene );
    finalComposer.addPass( finalPass );

    // materials

    darkMaterial = new THREE.MeshBasicMaterial( { color: 'black' } );

    // water

    waterGeometry = new THREE.PlaneBufferGeometry( 100, 100 );

    water = new Water( waterGeometry, {
        color        : params.color,
        scale        : params.scale,
        flowDirection: new THREE.Vector2( params.flowX, params.flowY ),
        textureWidth : 1024,
        textureHeight: 1024
    } );

    water.position.y = 1;
    water.rotation.x = Math.PI * -0.5;
    scene.add( water );

    // sphere

    // let sphere = new THREE.Mesh( new THREE.IcosahedronBufferGeometry( 3, 3 ), new THREE.MeshNormalMaterial() );
    // sphere.layers.enable( BLOOM_SCENE );
    // scene.add( sphere );

    // meshes

    objectLoader.load(
        'set.json',
        object => {
            object.traverse( object => {
                object.layers.enable( BLOOM_SCENE );
            } );
            object.rotation.y = Math.PI / 2;
            scene.add( object );
        },
        xhr => console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' ),
        error => console.error( `Error: ${ error }` )
    );

    // visualiser

    let visualiser        = new THREE.Mesh(
        new THREE.PlaneBufferGeometry( 10, 10 ),
        new THREE.CanvasTexture( document.getElementById( 'freq' ) )
    );
    visualiser.position.y = 2.443;
    visualiser.position.z = 13.367;

    // light

    ambientLight = new THREE.AmbientLight( 0xcccccc, 0.4 );
    scene.add( ambientLight );

    directionalLight = new THREE.DirectionalLight( 0xffffff, 0.6 );
    directionalLight.position.set( -1, 1, 1 );
    scene.add( directionalLight );

    // controls

    let orbitControls     = new OrbitControls( camera, renderer.domElement );
    orbitControls.enabled = params.controlsEnabled;

    // let transformControls = new TransformControls( camera, renderer.domElement );
    // transformControls.enabled = params.controlsEnabled;
    // transformControls.addEventListener( 'change', animate );

    // transformControls.addEventListener( 'dragging-changed', event => {
    //     orbitControls.enabled = !event.value;
    // } );

    // dat.gui

    gui = new GUI();
    gui.add( params, 'scale', 1, 10 ).onChange( value => {
        water.material.uniforms[ 'config' ].value.w = value;
    } );
    gui.add( params, 'flowX', -1, 1 ).step( 0.01 ).onChange( value => {
        water.material.uniforms[ 'flowDirection' ].value.x = value;
        water.material.uniforms[ 'flowDirection' ].value.normalize();
    } );
    gui.add( params, 'flowY', -1, 1 ).step( 0.01 ).onChange( value => {
        water.material.uniforms[ 'flowDirection' ].value.y = value;
        water.material.uniforms[ 'flowDirection' ].value.normalize();
    } );
    gui.add( params, 'exposure', 0.1, 2 ).onChange( value => {
        renderer.toneMappingExposure = Math.pow( value, 4.0 );
        render();
    } );
    gui.add( params, 'bloomThreshold', 0.0, 1.0 ).onChange( value => {
        bloomPass.threshold = Number( value );
        render();
    } );
    gui.add( params, 'bloomStrength', 0.0, 10.0 ).onChange( value => {
        bloomPass.strength = Number( value );
        render();
    } );
    gui.add( params, 'bloomRadius', 0.0, 1.0 ).step( 0.01 ).onChange( value => {
        bloomPass.radius = Number( value );
        render();
    } );
    gui.add( params, 'controlsEnabled' ).onChange( value => {
        // transformControls.enabled = value;
        // transformControls.update();
        orbitControls.enabled = value;
        orbitControls.update();
        // document.getElementById( 'info' ).style = `display: ${ value ? 'block' : 'none' }`;
    } );
    gui.open();

    window.addEventListener( 'resize', onResize, false );

    // transform controls events

    /*window.addEventListener( 'keydown', function ( event ) {
        switch ( event.keyCode ) {
            case 81: // Q
                transformControls.setSpace( transformControls.space === 'local' ? 'world' : 'local' );
                break;
            case 17: // Ctrl
                transformControls.setTranslationSnap( 100 );
                transformControls.setRotationSnap( Math.degToRad( 15 ) );
                break;
            case 87: // W
                transformControls.setMode( 'translate' );
                break;
            case 69: // E
                transformControls.setMode( 'rotate' );
                break;
            case 82: // R
                transformControls.setMode( 'scale' );
                break;
            case 187:
            case 107: // +, =, num+
                transformControls.setSize( transformControls.size + 0.1 );
                break;
            case 189:
            case 109: // -, _, num-
                transformControls.setSize( Math.max( transformControls.size - 0.1, 0.1 ) );
                break;
            case 88: // X
                transformControls.showX = !transformControls.showX;
                break;
            case 89: // Y
                transformControls.showY = !transformControls.showY;
                break;
            case 90: // Z
                transformControls.showZ = !transformControls.showZ;
                break;
            case 32: // Spacebar
                transformControls.enabled = !transformControls.enabled;
                break;
        }
    } );

    window.addEventListener( 'keyup', function ( event ) {
        switch ( event.keyCode ) {
            case 17: // Ctrl
                transformControls.setTranslationSnap( null );
                transformControls.setRotationSnap( null );
                break;
        }
    } );*/
}

function onResize () {
    let width  = window.innerWidth;
    let height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize( width, height );

    bloomComposer.setSize( width, height );
    finalComposer.setSize( width, height );

    render();
}

function animate () {
    requestAnimationFrame( animate );
    render();
}

function render () {
    // renderer.render( scene, camera );
    renderBloom( true );
    finalComposer.render();
}

function renderBloom ( mask ) {
    if ( mask === true ) {
        scene.traverse( darkenNonBloomed );
        bloomComposer.render();
        scene.traverse( restoreMaterial );
    } else {
        camera.layers.set( BLOOM_SCENE );
        bloomComposer.render();
        camera.layers.set( ENTIRE_SCENE );
    }
}

function darkenNonBloomed ( obj ) {
    if ( obj.type === 'Water' ) {
        return;
    }
    if ( obj.isMesh && bloomLayer.test( obj.layers ) === false ) {
        materials[ obj.uuid ] = obj.material;
        obj.material          = darkMaterial;
    }
}

function restoreMaterial ( obj ) {
    if ( materials[ obj.uuid ] ) {
        obj.material = materials[ obj.uuid ];
        delete materials[ obj.uuid ];
    }
}