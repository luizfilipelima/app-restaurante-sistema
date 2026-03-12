import { Navigate } from 'react-router-dom';

/**
 * Configurações de entregadores foram movidas para o modal de configurações do delivery.
 * Redireciona para a página de Pedidos com o modal aberto na aba "Entregadores".
 */
export default function AdminCouriers() {
  return <Navigate to="../orders?deliverySettings=entregadores" replace />;
}
