import { Navigate } from 'react-router-dom';

/**
 * Horários de funcionamento foram movidos para a aba "Horários" nas Configurações gerais.
 * Redireciona para Configurações com a aba Horários aberta.
 */
export default function AdminHorarios() {
  return <Navigate to="../settings#horarios" replace />;
}
