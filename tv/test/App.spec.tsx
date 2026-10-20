import 'react-native';
import React from 'react';
import {render} from '@testing-library/react-native';
import {App} from '../src/App';

jest.mock('@amazon-devices/react-native-w3cmedia', () => ({Video: () => null}));

describe('App', () => {
  it('shows the pairing screen before a phone reports', () => {
    (globalThis as any).fetch = jest.fn(() => new Promise(() => {}));
    const {getByText} = render(<App />);
    expect(getByText('Pair a phone to start')).toBeTruthy();
    expect(getByText('Waiting for the phone')).toBeTruthy();
  });
});
