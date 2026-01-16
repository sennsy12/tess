import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { ordersApi } from '../../lib/api';

interface OrderLine {
  linjenr: number;
  varekode: string;
  varenavn: string;
  varegruppe: string;
  antall: number;
  enhet: string;
  nettpris: number;
  linjesum: number;
  linjestatus: number;
  henvisning1?: string;
  henvisning2?: string;
  henvisning3?: string;
  henvisning4?: string;
  henvisning5?: string;
}

interface OrderDetail {
  ordrenr: number;
  dato: string;
  kundenr: string;
  kundenavn: string;
  kundeordreref: string;
  kunderef: string;
  firmaid: number;
  firmanavn: string;
  lagernavn: string;
  valutaid: string;
  sum: number;
  lines: OrderLine[];
}

export function KundeOrderDetail() {
  const { ordrenr } = useParams<{ ordrenr: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (ordrenr) {
      loadOrder(parseInt(ordrenr));
    }
  }, [ordrenr]);

  const loadOrder = async (id: number) => {
    try {
      const response = await ordersApi.getOne(id);
      setOrder(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Kunne ikke laste ordre');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Layout title="Ordre detaljer">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      </Layout>
    );
  }

  if (error || !order) {
    return (
      <Layout title="Ordre detaljer">
        <div className="card text-center py-12">
          <p className="text-red-400">{error || 'Ordre ikke funnet'}</p>
          <button onClick={() => navigate('/kunde/orders')} className="btn-secondary mt-4">
            ← Tilbake til ordrer
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={`Ordre #${order.ordrenr}`}>
      <div className="space-y-6">
        {/* Back button */}
        <button onClick={() => navigate('/kunde/orders')} className="btn-secondary">
          ← Tilbake til ordrer
        </button>

        {/* Order header */}
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <span className="text-sm text-dark-400">Ordrenummer</span>
              <p className="text-xl font-bold text-primary-400">#{order.ordrenr}</p>
            </div>
            <div>
              <span className="text-sm text-dark-400">Dato</span>
              <p className="text-lg font-medium">{new Date(order.dato).toLocaleDateString('nb-NO')}</p>
            </div>
            <div>
              <span className="text-sm text-dark-400">Kunde</span>
              <p className="text-lg font-medium">{order.kundenavn || order.kundenr}</p>
            </div>
            <div>
              <span className="text-sm text-dark-400">Total sum</span>
              <p className="text-xl font-bold text-green-400">
                {new Intl.NumberFormat('nb-NO', { style: 'currency', currency: order.valutaid || 'NOK' })
                  .format(order.sum)}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 pt-6 border-t border-dark-800">
            <div>
              <span className="text-sm text-dark-400">Firma</span>
              <p>{order.firmanavn || '-'}</p>
            </div>
            <div>
              <span className="text-sm text-dark-400">Lager</span>
              <p>{order.lagernavn || '-'}</p>
            </div>
            <div>
              <span className="text-sm text-dark-400">Kundeordrereferanse</span>
              <p>{order.kundeordreref || '-'}</p>
            </div>
          </div>
        </div>

        {/* Order lines */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Ordrelinjer ({order.lines.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Linje</th>
                  <th className="table-header">Varekode</th>
                  <th className="table-header">Varenavn</th>
                  <th className="table-header">Varegruppe</th>
                  <th className="table-header text-right">Antall</th>
                  <th className="table-header">Enhet</th>
                  <th className="table-header text-right">Pris</th>
                  <th className="table-header text-right">Sum</th>
                </tr>
              </thead>
              <tbody>
                {order.lines.map((line) => (
                  <tr key={line.linjenr} className="hover:bg-dark-800/30">
                    <td className="table-cell text-dark-400">{line.linjenr}</td>
                    <td className="table-cell font-mono text-sm">{line.varekode}</td>
                    <td className="table-cell font-medium">{line.varenavn || '-'}</td>
                    <td className="table-cell">
                      <span className="px-2 py-1 bg-primary-600/20 text-primary-300 rounded text-xs">
                        {line.varegruppe || '-'}
                      </span>
                    </td>
                    <td className="table-cell text-right">{line.antall}</td>
                    <td className="table-cell">{line.enhet}</td>
                    <td className="table-cell text-right">
                      {new Intl.NumberFormat('nb-NO', { minimumFractionDigits: 2 }).format(line.nettpris)}
                    </td>
                    <td className="table-cell text-right font-semibold">
                      {new Intl.NumberFormat('nb-NO', { minimumFractionDigits: 2 }).format(line.linjesum)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-dark-800/50">
                  <td colSpan={7} className="table-cell text-right font-semibold">
                    Totalt:
                  </td>
                  <td className="table-cell text-right font-bold text-lg text-green-400">
                    {new Intl.NumberFormat('nb-NO', { style: 'currency', currency: order.valutaid || 'NOK' })
                      .format(order.sum)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* References */}
        {order.lines.some(l => l.henvisning1 || l.henvisning2 || l.henvisning3) && (
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Henvisninger</h3>
            <div className="space-y-2">
              {order.lines.filter(l => l.henvisning1 || l.henvisning2).map((line) => (
                <div key={line.linjenr} className="p-3 bg-dark-800/50 rounded-lg">
                  <span className="text-dark-400 text-sm">Linje {line.linjenr}: </span>
                  {[line.henvisning1, line.henvisning2, line.henvisning3, line.henvisning4, line.henvisning5]
                    .filter(Boolean)
                    .map((ref, i) => (
                      <span key={i} className="inline-block px-2 py-1 bg-dark-700 rounded text-sm mr-2">
                        {ref}
                      </span>
                    ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
