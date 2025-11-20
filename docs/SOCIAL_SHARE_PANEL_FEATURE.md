# Social Share Panel Feature

A morphing side panel component that expands on hover to reveal social media share buttons arranged in a curved arc pattern.

## Features
- Small vertical panel on left edge of screen
- Expands on hover to show 5 social media icons
- Icons pop out in smooth arc animation
- Fully customizable styling matching dark UI theme
- Responsive and performant

## Implementation

### File Structure
```
src/
  components/
    level/
      SocialNodes.tsx      # Main component
      SocialNodes.css      # Styles and animations
```

### SocialNodes.tsx
```tsx
import './SocialNodes.css';
import { FaTwitter, FaFacebookF, FaWhatsapp, FaDiscord, FaPinterest } from 'react-icons/fa';

export const SocialNodes = () => {
  // Configuration for the 5 nodes
  const socialLinks = [
    { id: 1, icon: <FaTwitter />, className: 'node-1', url: 'https://twitter.com' },
    { id: 2, icon: <FaFacebookF />, className: 'node-2', url: 'https://facebook.com' },
    { id: 3, icon: <FaWhatsapp />, className: 'node-3', url: 'https://whatsapp.com' },
    { id: 4, icon: <FaDiscord />, className: 'node-4', url: 'https://discord.com' },
    { id: 5, icon: <FaPinterest />, className: 'node-5', url: 'https://pinterest.com' },
  ];

  return (
    <div className="fixed top-[60%] -translate-y-1/2 left-0 z-40">
      {/* Main Side Panel */}
      <div className="node-container">
        <div className="node-text">
          <span>SHARE</span>
        </div>

        {/* Mapping the 5 Icons */}
        {socialLinks.map((link) => (
          <a
            key={link.id}
            href={link.url}
            className={`node-item ${link.className}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Share on ${link.url}`}
          >
            {link.icon}
          </a>
        ))}

        {/* Invisible Helper Layer to keep menu open */}
        <div className="node-helper"></div>
      </div>
    </div>
  );
};
```

### SocialNodes.css
```css
/* SocialNodes.css */

/* --- Main Container (Side Panel) --- */
.node-container {
  /* Initial State: Small Vertical Panel */
  width: 25px;
  height: 100px;
  border-radius: 0 12px 12px 0; /* Rounded on right side only */

  /* Gradient Background matching UI */
  background: rgba(17, 24, 39, 0.95);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-left: none; /* No border on left edge */

  position: relative;
  cursor: pointer;
  box-shadow: 4px 0 10px rgba(0, 0, 0, 0.2);
  z-index: 10;

  /* Flex to center the text inside */
  display: flex;
  justify-content: center;
  align-items: center;

  /* Smooth transition */
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

/* --- Hover State: Expands panel --- */
.node-container:hover {
  width: 50px;
  height: 200px;
  border-radius: 0 25px 25px 0;
  box-shadow: 4px 0 25px rgba(0, 0, 0, 0.3);
}

/* --- The Text inside the Main Panel --- */
.node-text {
  color: #fff;
  font-weight: bold;
  font-size: 8px;
  /* Text is always vertical */
  transform: rotate(-90deg);
  letter-spacing: 1px;
  transition: all 0.3s;
}

.node-container:hover .node-text {
  color: #a855f7;
  font-size: 12px;
  letter-spacing: 2px;
}

/* --- General Style for Child Icons (Nodes) --- */
.node-item {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0); /* Hidden in center initially */

  width: 42px;
  height: 42px;
  background: rgba(17, 24, 39, 0.95);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  border-radius: 50%;

  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  text-decoration: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);

  opacity: 0;
  transition: all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  z-index: -1; /* Behind the main button */
}

/* Reveal items on hover */
.node-container:hover .node-item {
  opacity: 1;
}

.node-item:hover {
  background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%);
  color: #fff;
  transform: translate(-50%, -50%) scale(1.15) !important; /* Slight zoom on hover */
  box-shadow: 0 0 20px rgba(168, 85, 247, 0.5);
}

/* --- ARC POSITIONING LOGIC --- */
/* Icons pop out in curved arc around SHARE text */

/* 1. Top Node (Closer to panel) */
.node-container:hover .node-1 {
  top: 8%;
  left: 100px;
  transform: translate(-50%, -50%) scale(1);
  transition-delay: 0.05s;
}

/* 2. Mid-Top Node (Further out) */
.node-container:hover .node-2 {
  top: 25%;
  left: 130px;
  transform: translate(-50%, -50%) scale(1);
  transition-delay: 0.1s;
}

/* 3. Middle Node (Furthest point) */
.node-container:hover .node-3 {
  top: 50%;
  left: 150px;
  transform: translate(-50%, -50%) scale(1);
  transition-delay: 0.15s;
}

/* 4. Mid-Bottom Node (Further out) */
.node-container:hover .node-4 {
  top: 75%;
  left: 130px;
  transform: translate(-50%, -50%) scale(1);
  transition-delay: 0.2s;
}

/* 5. Bottom Node (Closer to panel) */
.node-container:hover .node-5 {
  top: 92%;
  left: 100px;
  transform: translate(-50%, -50%) scale(1);
  transition-delay: 0.25s;
}

/* --- Invisible Bridge/Helper --- */
/* Prevents the menu from closing when moving the mouse from panel to icons */
.node-helper {
  position: absolute;
  top: 0;
  left: 0;
  width: 180px; /* Width covers distance to icons */
  height: 100%; /* Full height of panel */
  background: transparent;
  z-index: -2;
  display: none;
}

.node-container:hover .node-helper {
  display: block;
}
```

## Usage in App

Add to your main App component:

```tsx
import { SocialNodes } from './components/level/SocialNodes';

function App() {
  return (
    <div>
      {/* Other components */}
      <SocialNodes />
    </div>
  );
}
```

## Dependencies

Install required icon library:
```bash
npm install react-icons
```

## Customization

### Change Position
Modify in `SocialNodes.tsx`:
```tsx
<div className="fixed top-[60%] -translate-y-1/2 left-0 z-40">
```

### Change Colors
Modify in `SocialNodes.css`:
- Panel background: `rgba(17, 24, 39, 0.95)`
- Accent color: `#a855f7` (purple)
- Hover gradient: `linear-gradient(135deg, #a855f7 0%, #ec4899 100%)`

### Change Social Links
Modify `socialLinks` array in `SocialNodes.tsx`:
```tsx
const socialLinks = [
  { id: 1, icon: <FaTwitter />, className: 'node-1', url: 'https://twitter.com' },
  // Add more...
];
```

### Adjust Arc Shape
Modify positioning in `SocialNodes.css`:
- Change `top` values (8%, 25%, 50%, 75%, 92%)
- Change `left` values (100px, 130px, 150px)
- Adjust `transition-delay` for animation timing

## Animation Details

- **Panel expansion**: 0.5s cubic-bezier(0.4, 0, 0.2, 1)
- **Icons pop-out**: 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) with staggered delays
- **Text rotation**: Always vertical (-90deg)
- **Hover effects**: Smooth scale and color transitions

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Requires CSS backdrop-filter support

## Performance Notes

- Uses CSS transforms for smooth 60fps animations
- Hardware accelerated transitions
- Lightweight DOM (only 7 elements)
- No JavaScript animations
