import { Navigate } from 'react-router-dom';

/**
 * Configurações de áreas de entrega foram movidas para o modal de configurações do delivery.
 * Redireciona para a página de Pedidos com o modal aberto na aba "Áreas de entrega".
 */
export default function AdminDeliveryZones() {
  return <Navigate to="../orders?deliverySettings=zonas" replace />;
}
