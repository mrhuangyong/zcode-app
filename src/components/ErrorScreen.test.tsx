import { fireEvent, render, screen } from '@testing-library/react-native';
import ErrorScreen from './ErrorScreen';

describe('ErrorScreen', () => {
  it('offers retry and reconfiguration without exposing the remote URL', async () => {
    const onRetry = jest.fn();
    const onSetup = jest.fn();
    await render(
      <ErrorScreen message="连接中断" onRetry={onRetry} onSetup={onSetup} />,
    );

    expect(screen.queryByText(/sid=/)).toBeNull();
    await fireEvent.press(screen.getByTestId('retry-button'));
    await fireEvent.press(screen.getByTestId('reconfigure-button'));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onSetup).toHaveBeenCalledTimes(1);
  });
});
