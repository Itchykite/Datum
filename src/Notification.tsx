import { useEffect, useState } from "react";

interface NotificationProps {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}

export function Notification({ message, type, onClose }: NotificationProps) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(onClose, 300);
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const handleClose = () => {
    setExiting(true);
    setTimeout(onClose, 300);
  };

  return (
    <div className={`notification ${type} ${exiting ? "exit" : ""}`}>
      <div className="notification-message">{message}</div>
      <button onClick={handleClose} className="notification-close">
        &times;
      </button>
    </div>
  );
}
