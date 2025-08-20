declare module 'pdf-parse' {
  const pdfParse: any;
  export = pdfParse;
}

declare module 'csv-parse' {
  export class Parser {
    constructor(options?: any);
    on(event: string, cb: (...args: any[]) => void): void;
    read(): any;
    write(content: string | Buffer): void;
    end(): void;
  }
}

declare module 'moment-timezone' {
  import moment = require('moment');
  export = moment;
}

declare module 'tesseract.js' {
  export function createWorker(lang?: string): Promise<any>;
}

declare module 'sharp' {
  const sharp: any;
  export = sharp;
}

declare module '@google-cloud/vision' {
  export class ImageAnnotatorClient {
    constructor(options?: any);
    documentTextDetection(image: string | Buffer | { content?: Buffer; source?: { filename?: string } }): Promise<any[]>;
  }
}

