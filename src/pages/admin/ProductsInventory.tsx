import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function ProductsInventory() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const newPath = location.pathname.replace(/\/products\/?$/, '/menu');
    navigate(newPath, { replace: true });
  }, []);

  return null;
}
