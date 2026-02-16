import { Outlet, useParams } from 'react-router-dom';
import AdminLayout from './AdminLayout';

/**
 * Envolve o AdminLayout para rotas /admin (restaurant_admin) e
 * /super-admin/restaurants/:restaurantId (super_admin gerenciando um restaurante).
 */
export default function AdminLayoutWrapper() {
  const { restaurantId } = useParams<{ restaurantId?: string }>();
  const isSuperAdminView = !!restaurantId;
  const basePath = isSuperAdminView
    ? `/super-admin/restaurants/${restaurantId}`
    : '/admin';

  return (
    <AdminLayout
      managedRestaurantId={restaurantId || null}
      basePath={basePath}
    >
      <Outlet />
    </AdminLayout>
  );
}
