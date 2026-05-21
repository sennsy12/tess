import { Layout } from '../../components/Layout';
import { OrdersListContent } from '../../components/orders/OrdersListContent';

export function AdminOrders() {
  return (
    <Layout title="Admin Ordrer">
      <OrdersListContent variant="admin" />
    </Layout>
  );
}
