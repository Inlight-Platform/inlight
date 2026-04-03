import React from 'react';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FloatingChatButtonProps {
  onClick: () => void;
}

const FloatingChatButton: React.FC<FloatingChatButtonProps> = ({ onClick }) => {
  return (
    <Button
      onClick={onClick}
      size="icon"
      className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all"
    >
      <Mail className="w-6 h-6" />
    </Button>
  );
};

export default FloatingChatButton;
