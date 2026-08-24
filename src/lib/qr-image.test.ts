import { ImageManipulator } from 'expo-image-manipulator';
import jsQR from 'jsqr';
import jpeg from 'jpeg-js';
import { decodeQrFromImage } from './qr-image';

jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { JPEG: 'jpeg' },
}));
jest.mock('jsqr', () => jest.fn());
jest.mock('jpeg-js', () => ({ decode: jest.fn() }));

const manipulateMock = ImageManipulator.manipulate as unknown as jest.Mock;
const jsqrMock = jsQR as unknown as jest.Mock;
const jpegDecodeMock = jpeg.decode as unknown as jest.Mock;

const remoteUrl =
  'https://zcode.z.ai/remote/v4?sid=session-id&hash=encoded%2Fvalue%3D&t=1&mid=mid&name=Mac.local&app_version=3.7.7';

type PipelineContext = {
  resize: jest.Mock;
  renderAsync: jest.Mock;
};

function mockPipeline(options: { base64?: string | null; qr?: string | null } = {}) {
  const saveAsync = jest.fn(async () => ({
    base64: options.base64 === undefined ? 'aGVsbG8=' : options.base64,
  }));
  const context: PipelineContext = {
    resize: jest.fn(() => context),
    renderAsync: jest.fn(async () => ({ saveAsync })),
  };
  manipulateMock.mockReturnValue(context);

  jpegDecodeMock.mockReturnValue({ data: new Uint8Array(16), width: 4, height: 4 });
  jsqrMock.mockReturnValue(options.qr === undefined ? { data: remoteUrl } : options.qr ? { data: options.qr } : null);

  return { context, saveAsync };
}

beforeEach(() => {
  manipulateMock.mockReset();
  jsqrMock.mockReset();
  jpegDecodeMock.mockReset();
});

describe('decodeQrFromImage', () => {
  it('resizes to a bounded width, saves as lossless JPEG and decodes the QR payload', async () => {
    const { context } = mockPipeline();

    await expect(decodeQrFromImage('file:///tmp/qr.png')).resolves.toBe(remoteUrl);

    expect(manipulateMock).toHaveBeenCalledWith('file:///tmp/qr.png');
    expect(context.resize).toHaveBeenCalledWith({ width: 1280 });
    expect(jsqrMock).toHaveBeenCalledWith(expect.any(Uint8ClampedArray), 4, 4);
  });

  it('returns null when the image contains no QR code', async () => {
    mockPipeline({ qr: null });

    await expect(decodeQrFromImage('file:///tmp/plain.png')).resolves.toBeNull();
  });

  it('returns null when the manipulated image has no base64 payload', async () => {
    mockPipeline({ base64: null });

    await expect(decodeQrFromImage('file:///tmp/empty.png')).resolves.toBeNull();
  });

  it('returns null when any pipeline step throws', async () => {
    manipulateMock.mockImplementation(() => {
      throw new Error('unsupported image');
    });

    await expect(decodeQrFromImage('file:///tmp/broken.heic')).resolves.toBeNull();
  });
});
