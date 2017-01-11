# Chroma.js adds chroma key to images


  It replaces img element with a WebGL canvas showing the same image but with one color transparent

  Usage:

      new Chroma(imgElement); // Chroma key of a single image. Chroma color is white by default

  or
  
    new Chroma(imgElement, {
      chroma:[0.99, 0.99, 0.99], // this is red, green, blue channel for the chroma key color that is going to be transparent
      tolerance: 0.05 // tolerance around chroma values, less is more strict
    })

  or for multiple images

    var chroma = new Chroma({
      chroma:[0.99, 0.99, 0.99],
      tolerance: 0.05
    })
    chroma.chromaKey(imgElement)  // image 1
    chroma.chromaKey(imgElement2) // image 2 ...