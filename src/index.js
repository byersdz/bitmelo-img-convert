#!/usr/bin/env node

const fs = require( 'fs' );
const program = require( 'commander' );
const Jimp = require( 'jimp' );

let fileValue = null;

program
  .version( '1.0.0' )
  .arguments( '<file>' )
  .action( ( file ) => {
    fileValue = file;
  } )
  .parse( process.argv );

if ( !fileValue ) {
  console.log( 'No file value specified!' );
  process.exit( 1 );
}

let palleteContents = null;

try {
  palleteContents = fs.readFileSync( './palette.json' );
}
catch ( error ) {
  console.log( 'Error getting palette.json!' );
  console.log( error );
  process.exit( 1 );
}

let paletteData = null;

try {
  paletteData = JSON.parse( palleteContents );
}
catch ( error ) {
  console.log( 'Could not parse palette.json!' );
  console.log( error );
  process.exit( 1 );
}

console.log( paletteData );

let configContents = null;

try {
  configContents = fs.readFileSync( './tileset-config.json' );
}
catch ( error ) {
  console.log( 'Error getting tileset-config.json!' );
  console.log( error );
  process.exit( 1 );
}

let configData = null;

try {
  configData = JSON.parse( configContents );
}
catch ( error ) {
  console.log( 'Could not parse tileset-config.json!' );
  console.log( error );
  process.exit( 1 );
}

Jimp.read( fileValue )
  .then( ( image ) => {
    console.log( image.bitmap.width );
    console.log( image.bitmap.height );
    if ( image.bitmap.width !== configData.tileSize * configData.width ) {
      console.log( 'Invalid image width!' );
      process.exit( 1 );
    }
    if ( image.bitmap.height !== configData.tileSize * configData.height ) {
      console.log( 'Invalid image height!' );
      process.exit( 1 );
    }

    const imageDataSize = image.bitmap.width * image.bitmap.height;
    console.log( imageDataSize );
    const imageData = new Array( image.bitmap.width * image.bitmap.height );
    let maxIndex = 0;
    let maxY = 0;
    image.scan( 0, 0, image.bitmap.width, image.bitmap.height, ( x, y, idx ) => {
      const adjustedY = ( configData.height * configData.tileSize ) - y - 1;

      if ( adjustedY > maxY ) {
        maxY = adjustedY;
      }
      const tileX = Math.floor( x / configData.tileSize );
      const tileY = Math.floor( adjustedY / configData.tileSize );

      // console.log( `${ x } ${ y } ${ adjustedY } ${ tileX } ${ tileY }` );

      const iPerTile = configData.tileSize * configData.tileSize;
      const startIndex = tileY * iPerTile * configData.width + ( tileX * iPerTile );

      const relativeX = x - ( tileX * configData.tileSize );
      const relativeY = adjustedY - ( tileY * configData.tileSize );

      const pixelIndex = startIndex + ( relativeY * configData.tileSize ) + relativeX;

      // const red = image.bitmap.data[idx];
      // const green = image.bitmap.data[idx + 1];
      // const blue = image.bitmap.data[idx + 2];
      const alpha = image.bitmap.data[idx + 3];

      let paletteId = 0;
      if ( alpha > 128 ) {
        paletteId = 2;
      }

      if ( pixelIndex > maxIndex ) {
        maxIndex = pixelIndex;
      }

      imageData[pixelIndex] = paletteId;
    } );

    console.log( maxIndex );
    const dataString = imageData.join( ',' );
    let tilesetJSON = '{ "data": [';
    tilesetJSON += dataString;
    tilesetJSON += '] }';

    fs.writeFile( './test.tileset.json', tilesetJSON, ( error ) => {
      if ( error ) {
        console.log( error );
        process.exit( 1 );
      }

      console.log( 'Tileset succesfully created!' );
    } );
  } )
  .catch( ( error ) => {
    console.log( 'Could not load image file!' );
    console.log( error );
    process.exit( 1 );
  } );
