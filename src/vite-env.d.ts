/// <reference types="vite/client" />

declare module 'qrcode' {
  export interface QRCodeToCanvasOptions {
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    margin?: number;
    scale?: number;
    width?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }

  export interface QRCodeModel {
    modules: {
      size: number;
      data: boolean[];
      get: (col: number, row: number) => number | boolean;
    };
  }

  export function toCanvas(
    canvas: HTMLCanvasElement,
    text: string,
    options?: QRCodeToCanvasOptions
  ): Promise<void>;

  export function create(text: string, options?: QRCodeToCanvasOptions): QRCodeModel;
}
