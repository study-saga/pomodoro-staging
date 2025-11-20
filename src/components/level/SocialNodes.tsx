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
