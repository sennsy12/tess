import { Layout } from '../../components/Layout';
import { OrdersListContent } from '../../components/orders/OrdersListContent';

export function KundeOrders() {
  return (
    <Layout title="Ordrer">
      <OrdersListContent variant="kunde" />
    </Layout>
  );
}
