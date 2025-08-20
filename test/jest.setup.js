// Mock environment variables
process.env.GOOGLE_CLOUD_CREDENTIALS = 'test-credentials.json';
process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
process.env.AWS_REGION = 'us-east-1';
process.env.S3_BUCKET = 'test-bucket';

// Mock fs module for tests
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn().mockImplementation((path) => {
    if (path.endsWith('.pdf')) {
      return Buffer.from('PDF content');
    }
    if (path.endsWith('.csv')) {
      return Buffer.from('CSV content');
    }
    if (path.endsWith('.txt')) {
      return Buffer.from('Text content');
    }
    return Buffer.from('');
  }),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn()
}));

// Mock sharp module
jest.mock('sharp', () => {
  return jest.fn().mockImplementation(() => ({
    normalize: jest.fn().mockReturnThis(),
    sharpen: jest.fn().mockReturnThis(),
    threshold: jest.fn().mockReturnThis(),
    linear: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('Processed image'))
  }));
});

// Mock tesseract.js
jest.mock('tesseract.js', () => ({
  createWorker: jest.fn().mockResolvedValue({
    recognize: jest.fn().mockResolvedValue({
      data: {
        text: 'OCR extracted text',
        confidence: 90
      }
    }),
    terminate: jest.fn()
  })
}));

// Mock pdf-parse
jest.mock('pdf-parse', () => {
  return jest.fn().mockResolvedValue({
    text: 'PDF extracted text',
    numpages: 2,
    info: {
      Author: 'Test Author',
      CreationDate: 'D:20230101000000Z'
    },
    metadata: {
      'dc:title': 'Test Document'
    },
    version: '1.7'
  });
});

// Mock @google-cloud/vision
jest.mock('@google-cloud/vision', () => ({
  Vision: jest.fn().mockImplementation(() => ({
    batchAnnotateImages: jest.fn().mockResolvedValue([{
      responses: [{
        fullTextAnnotation: {
          text: 'Vision API extracted text',
          pages: [{
            blocks: [{
              paragraphs: [{
                words: [{
                  symbols: [{
                    text: 'T',
                    confidence: 0.99
                  }]
                }]
              }]
            }]
          }]
        },
        textAnnotations: [{
          description: 'Vision API extracted text',
          confidence: 0.95
        }]
      }]
    }])
  }))
}));

// Mock @google-cloud/storage
jest.mock('@google-cloud/storage', () => ({
  Storage: jest.fn().mockImplementation(() => ({
    bucket: jest.fn().mockReturnValue({
      file: jest.fn().mockReturnValue({
        createWriteStream: jest.fn().mockReturnValue({
          on: jest.fn(),
          end: jest.fn()
        }),
        delete: jest.fn().mockResolvedValue([{}])
      })
    })
  }))
}));

// Mock aws-sdk
jest.mock('aws-sdk', () => ({
  S3: jest.fn().mockImplementation(() => ({
    upload: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({ Location: 'https://test-bucket.s3.amazonaws.com/test.pdf' })
    }),
    deleteObject: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({})
    })
  }))
}));
