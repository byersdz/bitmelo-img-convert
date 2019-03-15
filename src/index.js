#!/usr/bin/env node

const fs = require( 'fs' );
const program = require( 'commander' );
const Jimp = require( 'jimp' );

let fileValue = null;

program
  .version( '1.0.0' )
  .arguments( '<file>' )
  .option( '-f, --font', 'convert a font' )
  .action( ( file ) => {
    fileValue = file;
  } )
  .parse( process.argv );

if ( !fileValue ) {
  console.log( 'No file value specified!' );
  process.exit( 1 );
}

const fileName = fileValue.split( '.' )[0];

let configContents = null;

try {
  if ( program.font ) {
    const configPath = `${ fileName }.config.json`;
    configContents = fs.readFileSync( configPath );
  }
  else {
    configContents = fs.readFileSync( './tileset-config.json' );
  }
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
    const width = image.bitmap.width / configData.tileSize;
    const height = image.bitmap.height / configData.tileSize;
    if ( !Number.isInteger( width ) ) {
      console.log( 'Invalid image width!' );
      process.exit( 1 );
    }
    if ( !Number.isInteger( height ) ) {
      console.log( 'Invalid image height!' );
      process.exit( 1 );
    }

    const imageData = new Array( image.bitmap.width * image.bitmap.height );
    let maxIndex = 0;
    let maxY = 0;
    image.scan( 0, 0, image.bitmap.width, image.bitmap.height, ( x, y, idx ) => {
      const adjustedY = ( height * configData.tileSize ) - y - 1;

      if ( adjustedY > maxY ) {
        maxY = adjustedY;
      }
      const tileX = Math.floor( x / configData.tileSize );
      const tileY = Math.floor( adjustedY / configData.tileSize );

      const iPerTile = configData.tileSize * configData.tileSize;
      const startIndex = tileY * iPerTile * width + ( tileX * iPerTile );

      const relativeX = x - ( tileX * configData.tileSize );
      const relativeY = adjustedY - ( tileY * configData.tileSize );

      const pixelIndex = startIndex + ( relativeY * configData.tileSize ) + relativeX;

      const red = image.bitmap.data[idx];
      const green = image.bitmap.data[idx + 1];
      const blue = image.bitmap.data[idx + 2];
      const alpha = image.bitmap.data[idx + 3];

      let paletteId = 0;
      if ( alpha > 128 ) {
        if ( program.font ) {
          // white is the main font color
          // black is the outline font color
          if ( red > 128 ) {
            paletteId = 1; // main color
          }
          else {
            paletteId = 2; // outline color
          }
        }
        else {
          // find the closest palette color
          let minDistance = 10000;
          let closestId = 1;
          for ( let i = 1; i < configData.palette.length; i += 1 ) {
            const color = configData.palette[i];
            let distance = Math.abs( red - color[0] );
            distance += Math.abs( green - color[1] );
            distance += Math.abs( blue - color[2] );
            if ( distance < minDistance ) {
              minDistance = distance;
              closestId = i;
            }
          }
          paletteId = closestId;
        }
      }

      if ( pixelIndex > maxIndex ) {
        maxIndex = pixelIndex;
      }

      imageData[pixelIndex] = paletteId;
    } );

    // compress the image data using run length encoding

    const runLengthData = [];
    let currentValue = imageData[0];
    let runNumber = 0;
    for ( let i = 0; i < imageData.length; i += 1 ) {
      if ( imageData[i] === currentValue ) {
        runNumber += 1;
      }
      else {
        runLengthData.push( runNumber );
        runLengthData.push( currentValue );
        runNumber = 1;
        currentValue = imageData[i];
      }
    }
    runLengthData.push( runNumber );
    runLengthData.push( currentValue );

    const runDataString = runLengthData.join( ',' );
    const csvDataString = imageData.join( ',' );

    let dataString = runDataString;
    let format = 'run';

    if ( runDataString.length > csvDataString ) {
      dataString = csvDataString;
      format = 'array';
    }

    if ( program.font ) {
      const fontOutput = {};
      fontOutput.name = fileName;
      fontOutput.tileSize = configData.tileSize;
      fontOutput.width = width;
      fontOutput.height = height;
      fontOutput.originX = configData.originX;
      fontOutput.originY = configData.originY;
      fontOutput.standardWidth = configData.standardWidth;
      fontOutput.letterSpacing = configData.letterSpacing;
      fontOutput.charData = configData.charData;
      fontOutput.data = runLengthData;

      const fontJSON = JSON.stringify( fontOutput );
      fs.writeFile( `./${ fileName }.font.json`, fontJSON, ( error ) => {
        if ( error ) {
          console.log( error );
          process.exit( 1 );
        }

        console.log( 'Font succesfully created!' );
      } );
    }
    else {
      let tilesetJSON = `{\n  "format": "${ format }", \n`;
      tilesetJSON += `  "name": "${ fileName }", \n`;
      tilesetJSON += `  "tileSize": ${ configData.tileSize }, \n`;
      tilesetJSON += `  "width": ${ width }, \n`;
      tilesetJSON += `  "height": ${ height }, \n`;
      tilesetJSON += '  "data": [\n    ';
      tilesetJSON += dataString;
      tilesetJSON += '\n  ]\n}';

      fs.writeFile( `./${ fileName }.tileset.json`, tilesetJSON, ( error ) => {
        if ( error ) {
          console.log( error );
          process.exit( 1 );
        }

        console.log( 'Tileset succesfully created!' );
      } );
    }
  } )
  .catch( ( error ) => {
    console.log( 'Could not load image file!' );
    console.log( error );
    process.exit( 1 );
  } );
