/**
 * @author Kai Salmen / www.kaisalmen.de
 */

'use strict';

var WWParallels = (function () {

	var Validator = THREE.LoaderSupport.Validator;

	function WWParallels( elementToBindTo ) {
		this.renderer = null;
		this.canvas = elementToBindTo;
		this.aspectRatio = 1;
		this.recalcAspectRatio();

		this.scene = null;
		this.cameraDefaults = {
			posCamera: new THREE.Vector3( 0.0, 175.0, 500.0 ),
			posCameraTarget: new THREE.Vector3( 0, 0, 0 ),
			near: 0.1,
			far: 10000,
			fov: 45
		};
		this.camera = null;
		this.cameraTarget = this.cameraDefaults.posCameraTarget;

		this.logger = new THREE.LoaderSupport.ConsoleLogger();
		this.logger.setEnabled( false );
		this.workerDirector = new THREE.LoaderSupport.WorkerDirector( THREE.OBJLoader2, this.logger  );
		this.workerDirector.setCrossOrigin( 'anonymous' );

		this.controls = null;
		this.cube = null;

		this.allAssets = [];
		this.feedbackArray = null;

		this.running = false;
	}

	WWParallels.prototype.initGL = function () {
		this.renderer = new THREE.WebGLRenderer( {
			canvas: this.canvas,
			antialias: true,
			autoClear: true
		} );
		this.renderer.setClearColor( 0x050505 );

		this.scene = new THREE.Scene();

		this.camera = new THREE.PerspectiveCamera( this.cameraDefaults.fov, this.aspectRatio, this.cameraDefaults.near, this.cameraDefaults.far );
		this.resetCamera();
		this.controls = new THREE.TrackballControls( this.camera, this.renderer.domElement );

		var ambientLight = new THREE.AmbientLight( 0x404040 );
		var directionalLight1 = new THREE.DirectionalLight( 0xC0C090 );
		var directionalLight2 = new THREE.DirectionalLight( 0xC0C090 );

		directionalLight1.position.set( -100, -50, 100 );
		directionalLight2.position.set( 100, 50, -100 );

		this.scene.add( directionalLight1 );
		this.scene.add( directionalLight2 );
		this.scene.add( ambientLight );

		var geometry = new THREE.BoxGeometry( 10, 10, 10 );
		var material = new THREE.MeshNormalMaterial();
		this.cube = new THREE.Mesh( geometry, material );
		this.cube.position.set( 0, 0, 0 );
		this.scene.add( this.cube );
	};

	WWParallels.prototype.resizeDisplayGL = function () {
		this.controls.handleResize();

		this.recalcAspectRatio();
		this.renderer.setSize( this.canvas.offsetWidth, this.canvas.offsetHeight, false );

		this.updateCamera();
	};

	WWParallels.prototype.recalcAspectRatio = function () {
		this.aspectRatio = ( this.canvas.offsetHeight === 0 ) ? 1 : this.canvas.offsetWidth / this.canvas.offsetHeight;
	};

	WWParallels.prototype.resetCamera = function () {
		this.camera.position.copy( this.cameraDefaults.posCamera );
		this.cameraTarget.copy( this.cameraDefaults.posCameraTarget );

		this.updateCamera();
	};

	WWParallels.prototype.updateCamera = function () {
		this.camera.aspect = this.aspectRatio;
		this.camera.lookAt( this.cameraTarget );
		this.camera.updateProjectionMatrix();
	};

	WWParallels.prototype.render = function () {
		if ( ! this.renderer.autoClear ) this.renderer.clear();

		this.controls.update();

		this.cube.rotation.x += 0.05;
		this.cube.rotation.y += 0.05;

		this.renderer.render( this.scene, this.camera );
	};

	WWParallels.prototype._reportProgress = function( content ) {
		var output = content;
		if ( Validator.isValid( content ) && Validator.isValid( content.detail ) ) output = content.detail.text;

		output = Validator.verifyInput( output, '' );
		this.logger.logInfo( 'Progress:\n\t' + output.replace(/\<br\>/g, '\n\t' ) );
		document.getElementById( 'feedback' ).innerHTML = output;
	};

	WWParallels.prototype.enqueueAllAssests = function ( maxQueueSize, maxWebWorkers, streamMeshes ) {
		if ( this.running ) {

			return;

		} else {

			this.running = true;

		}

		var scope = this;
		scope.workerDirector.objectsCompleted = 0;
		scope.feedbackArray = [];
		scope.reportDonwload = [];

		var i;
		for ( i = 0; i < maxWebWorkers; i++ ) {

			scope.feedbackArray[ i ] = 'Worker #' + i + ': Awaiting feedback';
			scope.reportDonwload[ i ] = true;

		}
		scope._reportProgress( scope.feedbackArray.join( '\<br\>' ) );

		var callbackOnLoad = function ( event ) {
			var instanceNo = event.detail.instanceNo;
			scope.reportDonwload[ instanceNo ] = false;
			scope.allAssets.push( event.detail.loaderRootNode );

			var msg = 'Worker #' + instanceNo + ': Completed loading: ' + event.detail.modelName + ' (#' + scope.workerDirector.objectsCompleted + ')';
			scope.logger.logInfo( msg );
			scope.feedbackArray[ instanceNo ] = msg;
			scope._reportProgress( scope.feedbackArray.join( '\<br\>' ) );

			if ( scope.workerDirector.objectsCompleted + 1 === maxQueueSize ) scope.running = false;
		};

		var callbackReportProgress = function ( event ) {
			var	instanceNo = event.detail.instanceNo;
			var text = event.detail.text;

			if ( scope.reportDonwload[ instanceNo ] ) {
				var msg = 'Worker #' + instanceNo + ': ' + text;
				scope.logger.logInfo( msg );

				scope.feedbackArray[ instanceNo ] = msg;
				scope._reportProgress( scope.feedbackArray.join( '\<br\>' ) );
			}
		};

		var callbackMeshAlter = function ( event ) {
			var override = new THREE.LoaderSupport.LoadedMeshUserOverride( false, false );

			var material = event.detail.material;
			var meshName = event.detail.meshName;
			if ( Validator.isValid( material ) && material.name === 'defaultMaterial' || meshName === 'Mesh_Mesh_head_geo.001_lambert2SG.001' ) {

				var materialOverride = material;
				materialOverride.color = new THREE.Color( Math.random(), Math.random(), Math.random() );
				var mesh = new THREE.Mesh( event.detail.bufferGeometry, material );
				mesh.name = meshName;

				override.addMesh( mesh );

			}
			return override;
		};

		var callbacks = new THREE.LoaderSupport.Callbacks();
		callbacks.setCallbackOnProgress( callbackReportProgress );
		callbacks.setCallbackOnLoad( callbackOnLoad );
		callbacks.setCallbackOnMeshAlter( callbackMeshAlter );

		this.workerDirector.prepareWorkers( callbacks, maxQueueSize, maxWebWorkers );
		this.logger.logInfo( 'Configuring WWManager with queue size ' + this.workerDirector.getMaxQueueSize() + ' and ' + this.workerDirector.getMaxWebWorkers() + ' workers.' );

		var modelPrepDatas = [];
		prepData = new THREE.LoaderSupport.PrepData( 'male02' );
		prepData.addResource( new THREE.LoaderSupport.ResourceDescriptor( '../../resource/obj/male02/male02.obj', 'OBJ ') );
		prepData.addResource( new THREE.LoaderSupport.ResourceDescriptor( '../../resource/obj/male02/male02.mtl', 'MTL' ) );
		modelPrepDatas.push( prepData );

		prepData = new THREE.LoaderSupport.PrepData( 'female02' );
		prepData.addResource( new THREE.LoaderSupport.ResourceDescriptor( '../../resource/obj/female02/female02.obj', 'OBJ' ) );
		prepData.addResource( new THREE.LoaderSupport.ResourceDescriptor( '../../resource/obj/female02/female02.mtl', 'MTL' ) );
		modelPrepDatas.push( prepData );

		prepData = new THREE.LoaderSupport.PrepData( 'viveController' );
		prepData.addResource( new THREE.LoaderSupport.ResourceDescriptor( '../../resource/obj/vive-controller/vr_controller_vive_1_5.obj', 'OBJ' ) );
		prepData.scale = 400.0;
		modelPrepDatas.push( prepData );

		prepData = new THREE.LoaderSupport.PrepData( 'cerberus' );
		prepData.addResource( new THREE.LoaderSupport.ResourceDescriptor( '../../resource/obj/cerberus/Cerberus.obj', 'OBJ' ) );
		prepData.scale = 50.0;
		modelPrepDatas.push( prepData );

		prepData = new THREE.LoaderSupport.PrepData( 'WaltHead' );
		prepData.addResource( new THREE.LoaderSupport.ResourceDescriptor( '../../resource/obj/walt/WaltHead.obj', 'OBJ' ) );
		prepData.addResource( new THREE.LoaderSupport.ResourceDescriptor( '../../resource/obj/walt/WaltHead.mtl', 'MTL' ) );
		modelPrepDatas.push( prepData );

		var pivot;
		var distributionBase = -500;
		var distributionMax = 1000;
		var modelPrepDataIndex = 0;
		var modelPrepData;
		var prepData;
		var scale;
		for ( i = 0; i < maxQueueSize; i++ ) {

			modelPrepDataIndex = Math.floor( Math.random() * modelPrepDatas.length );

			modelPrepData = modelPrepDatas[ modelPrepDataIndex ];
			scale = Validator.verifyInput( modelPrepData.scale, 0 );
			modelPrepData = modelPrepData.clone();

			pivot = new THREE.Object3D();
			pivot.position.set(
				distributionBase + distributionMax * Math.random(),
				distributionBase + distributionMax * Math.random(),
				distributionBase + distributionMax * Math.random()
			);
			if ( scale > 0 ) pivot.scale.set( scale, scale, scale );
			this.scene.add( pivot );
			modelPrepData.setStreamMeshesTo( pivot );
			modelPrepData.setUseAsync( true );

			this.workerDirector.enqueueForRun( modelPrepData );
		}

		this.workerDirector.processQueue();
	};

	WWParallels.prototype.clearAllAssests = function () {
		var storedObject3d;
		for ( var asset in this.allAssets ) {

			storedObject3d = this.allAssets[ asset ];
			var scope = this;
			var remover = function ( object3d ) {

				if ( storedObject3d === object3d ) return;

				scope.logger.logInfo( 'Removing ' + object3d.name );
				scope.scene.remove( object3d );

				if ( object3d.hasOwnProperty( 'geometry' ) ) object3d.geometry.dispose();
				if ( object3d.hasOwnProperty( 'material' ) ) {

					var mat = object3d.material;
					if ( mat.hasOwnProperty( 'materials' ) ) {

						var materials = mat.materials;
						for ( var name in materials ) {

							if ( materials.hasOwnProperty( name ) ) materials[ name ].dispose();

						}
					}
				}
				if ( object3d.hasOwnProperty( 'texture' ) )	object3d.texture.dispose();
			};
			if ( Validator.isValid( storedObject3d ) ) {

				if ( this.pivot !== storedObject3d ) scope.scene.remove( storedObject3d );
				storedObject3d.traverse( remover );
				storedObject3d = null;

			}
		}
		this.allAssets = [];
	};

	WWParallels.prototype.terminateManager = function () {
		this.workerDirector.deregister();
		this.running = false;
	};

	return WWParallels;

})();
