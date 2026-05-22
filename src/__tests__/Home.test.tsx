import { render, screen } from '@testing-library/react-native';
import Home from '@/screens/Home';

describe('Home screen', () => {
  it('renders the "Strength Log" heading', () => {
    render(<Home />);
    expect(screen.getByText('Strength Log')).toBeTruthy();
  });
});
