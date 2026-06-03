import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ProgramLibrary from '@/screens/ProgramLibrary';
import { ALL_PRESETS } from '@/programs/presets';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}));

describe('ProgramLibrary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all built-in presets', () => {
    const { getByTestId, getByText } = render(<ProgramLibrary />);
    for (const preset of ALL_PRESETS) {
      expect(getByTestId(`preset-row-${preset.id}`)).toBeTruthy();
      expect(getByText(preset.name)).toBeTruthy();
    }
    expect(getByText(/26 SETS\/WK/)).toBeTruthy();
  });

  it('navigates to ProgramPreview on row press', () => {
    const { getByTestId } = render(<ProgramLibrary />);
    fireEvent.press(getByTestId('preset-row-linear-5x5'));
    expect(mockNavigate).toHaveBeenCalledWith('ProgramPreview', { presetId: 'linear-5x5' });
  });

  it('goes back when back button pressed', () => {
    const { getByTestId } = render(<ProgramLibrary />);
    fireEvent.press(getByTestId('program-library-back'));
    expect(mockGoBack).toHaveBeenCalled();
  });
});
