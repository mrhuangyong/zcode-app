import { fireEvent, render, screen } from '@testing-library/react-native';
import SetupScreen from './SetupScreen';

const remoteUrl =
  'https://zcode.z.ai/remote/v4?sid=session-id&hash=encoded%2Fvalue%3D&t=1&mid=mid&name=Mac.local&app_version=3.7.7';

async function setup(onConnect = jest.fn()) {
  await render(<SetupScreen onConnect={onConnect} />);

  return {
    onConnect,
    input: screen.getByTestId('remote-url-input'),
    submit: screen.getByTestId('connect-button'),
  };
}

describe('SetupScreen', () => {
  it('explains the security boundary and accepts an official remote URL', async () => {
    const { input, submit, onConnect } = await setup();

    await fireEvent.changeText(input, remoteUrl);
    await fireEvent.press(submit);

    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(onConnect).toHaveBeenCalledWith(remoteUrl);
    expect(screen.getByText(/只保存在本机安全存储/)).toBeTruthy();
  });

  it('rejects unsafe URLs without invoking connect', async () => {
    const { input, submit, onConnect } = await setup();

    expect(screen.queryByTestId('setup-error')).toBeNull();

    await fireEvent.changeText(input, 'https://evil.example/remote/v4?sid=1');
    await fireEvent.press(submit);

    expect(onConnect).not.toHaveBeenCalled();
    expect(screen.getByTestId('setup-error')).toBeTruthy();
  });

  it('can clear an existing value', async () => {
    const { input } = await setup();

    await fireEvent.changeText(input, remoteUrl);
    await fireEvent.press(screen.getByTestId('clear-button'));

    expect(input.props.value).toBe('');
  });
});
