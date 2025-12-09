import styled from 'styled-components';
import { useMouseActivity } from '../../hooks/useMouseActivity';
import { useSettingsStore } from '../../store/useSettingsStore';
import snowIcon from '../../assets/snow.svg';

const SnowToggle = () => {
  const { toggleSnow, snowEnabled, autoHideUI } = useSettingsStore();
  const isMouseActive = useMouseActivity(8000);

  const shouldShow = isMouseActive || !autoHideUI;

  return (
    <ButtonContainer
      onClick={toggleSnow}
      className="bg-black/40 backdrop-blur-md border border-gray-400/60 hover:bg-black/60"
      aria-label="Toggle Snow"
      title={snowEnabled ? "Disable Snow" : "Enable Snow"}
      style={{
        opacity: shouldShow ? 1 : 0,
        pointerEvents: shouldShow ? 'auto' : 'none'
      }}
    >
      <StyledIcon src={snowIcon} alt="Snow Toggle" $enabled={snowEnabled} />
    </ButtonContainer>
  );
}

// Matches Discord/Settings button dimensions (p-3 with 24px icon = 48px box)
const ButtonContainer = styled.button`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 50px; /* p-3 (12px*2) + 24px icon = 48px + 2px border approx */
  height: 50px;
  border-radius: 9999px; /* rounded-full */
  cursor: pointer;
  transition: all 0.3s ease;
  overflow: hidden;
  
  /* Tailwind classes handled via className prop, but specific overrides here if needed */
`;

const StyledIcon = styled.img<{ $enabled: boolean }>`
  width: 24px;
  height: 24px;
  object-fit: contain;
  opacity: ${props => props.$enabled ? 1 : 0.4};
  transition: opacity 0.3s ease;
`;

export default SnowToggle;
