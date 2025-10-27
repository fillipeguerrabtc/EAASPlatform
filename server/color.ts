// server/color.ts
// Conversões sRGB <-> XYZ <-> LAB e KMeans simples para clusterização de cores dominantes.
// Sem dependências externas: determinístico e rápido o bastante para snapshots.
// Implementação com clamping/rounding guards conforme recomendação do Architect.

export type RGB = { r: number; g: number; b: number };          // 0..255
export type LAB = { L: number; a: number; b: number };          // L in [0..100] approx

/**
 * Converte valor sRGB (0-255) para linear
 */
function srgbToLinear(c: number): number {
  // Clamp input to valid range
  const clamped = Math.max(0, Math.min(255, c));
  const cs = clamped / 255;
  return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

/**
 * Converte valor linear para sRGB (0-255)
 */
function linearToSrgb(x: number): number {
  const v = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1/2.4) - 0.055;
  // Clamp and round to valid RGB range
  return Math.min(255, Math.max(0, Math.round(v * 255)));
}

/**
 * Converte RGB para XYZ usando matriz D65
 */
function rgbToXyz({ r, g, b }: RGB): { X: number; Y: number; Z: number } {
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);
  
  // D65 transformation matrix
  const X = R*0.4124564 + G*0.3575761 + B*0.1804375;
  const Y = R*0.2126729 + G*0.7151522 + B*0.0721750;
  const Z = R*0.0193339 + G*0.1191920 + B*0.9503041;
  
  return { X, Y, Z };
}

/**
 * Converte XYZ para RGB usando matriz inversa D65
 */
function xyzToRgb({ X, Y, Z }: { X: number; Y: number; Z: number }): RGB {
  // Inverse matrix
  const R =  3.2404542*X + -1.5371385*Y + -0.4985314*Z;
  const G = -0.9692660*X +  1.8760108*Y +  0.0415560*Z;
  const B =  0.0556434*X + -0.2040259*Y +  1.0572252*Z;
  
  return { 
    r: linearToSrgb(R), 
    g: linearToSrgb(G), 
    b: linearToSrgb(B) 
  };
}

// D65 white point
const Xn = 0.95047, Yn = 1.00000, Zn = 1.08883;

/**
 * Função f para conversão LAB
 */
function fLab(t: number): number {
  return t > 216/24389 ? Math.cbrt(t) : (841/108)*t + 4/29;
}

/**
 * Função f inversa para conversão LAB
 */
function finvLab(t: number): number {
  const t3 = t*t*t;
  return t3 > 216/24389 ? t3 : (108/841)*(t - 4/29);
}

/**
 * Converte RGB para LAB (CIELAB color space)
 */
export function rgbToLab(rgb: RGB): LAB {
  const { X, Y, Z } = rgbToXyz(rgb);
  const fx = fLab(X / Xn);
  const fy = fLab(Y / Yn);
  const fz = fLab(Z / Zn);
  
  return { 
    L: 116*fy - 16, 
    a: 500*(fx - fy), 
    b: 200*(fy - fz) 
  };
}

/**
 * Converte LAB para RGB
 */
export function labToRgb(lab: LAB): RGB {
  const fy = (lab.L + 16) / 116;
  const fx = fy + lab.a / 500;
  const fz = fy - lab.b / 200;
  
  const X = Xn * finvLab(fx);
  const Y = Yn * finvLab(fy);
  const Z = Zn * finvLab(fz);
  
  return xyzToRgb({ X, Y, Z });
}

/**
 * Converte RGB para hexadecimal
 */
export function rgbToHex({ r, g, b }: RGB): string {
  const h = (n: number) => {
    // Ensure valid range
    const clamped = Math.max(0, Math.min(255, Math.round(n)));
    return clamped.toString(16).padStart(2, "0");
  };
  return `#${h(r)}${h(g)}${h(b)}`.toLowerCase();
}

/**
 * Distância ΔE (CIE76) entre duas cores LAB
 */
export function deltaE(a: LAB, b: LAB): number {
  const dL = a.L - b.L;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return Math.sqrt(dL*dL + da*da + db*db);
}

/**
 * K-Means clustering simples em espaço LAB
 * @param points Array de pontos LAB
 * @param k Número de clusters
 * @param maxIter Máximo de iterações (default: 25)
 * @returns Array de centros LAB
 */
export function kmeansLAB(points: LAB[], k: number, maxIter = 25): LAB[] {
  if (points.length === 0) return [];
  if (k <= 0) return [];
  if (k > points.length) k = points.length;
  
  // Init: amostragem uniforme
  const step = Math.max(1, Math.floor(points.length / k));
  const centers: LAB[] = Array.from({ length: k }, (_, i) => {
    const index = Math.min(i * step, points.length - 1);
    return { ...points[index] };
  });
  
  const assign = new Array(points.length).fill(0);

  for (let it = 0; it < maxIter; it++) {
    let changed = false;
    
    // Assignment step
    for (let i = 0; i < points.length; i++) {
      let best = 0;
      let bestD = Infinity;
      
      for (let c = 0; c < centers.length; c++) {
        const d = deltaE(points[i], centers[c]);
        if (d < bestD) { 
          bestD = d; 
          best = c; 
        }
      }
      
      if (assign[i] !== best) { 
        assign[i] = best; 
        changed = true; 
      }
    }
    
    // Convergence early-exit
    if (!changed && it > 0) break;
    
    // Update step
    const sums = Array.from({ length: k }, () => ({ L: 0, a: 0, b: 0, n: 0 }));
    for (let i = 0; i < points.length; i++) {
      const c = assign[i];
      const p = points[i];
      sums[c].L += p.L;
      sums[c].a += p.a;
      sums[c].b += p.b;
      sums[c].n++;
    }
    
    for (let c = 0; c < k; c++) {
      if (sums[c].n > 0) {
        centers[c] = { 
          L: sums[c].L / sums[c].n, 
          a: sums[c].a / sums[c].n, 
          b: sums[c].b / sums[c].n 
        };
      }
    }
  }
  
  return centers;
}
