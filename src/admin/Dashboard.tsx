import { Link } from 'react-router-dom';
import { adminApi } from '../lib/api';
import { inrRaw, relativeTime } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { useApp } from '../lib/store';
import { WhatsAppIcon } from '../components/icons';

export function Dashboard() {
  const { notify } = useApp();
  const { data, loading, reload } = useAsync(() => adminApi.stats(), []);
  const { data: meta } = useAsync(() => adminApi.meta(), []);
  const { data: enquiryData } = useAsync(() => adminApi.enquiries({ status: 'pending' }), []);

  const stats = data;

  const restock = async (id: string, name: string) => {
    try {
      await adminApi.adjustStock(id, { delta: 1, reason: 'quick-restock' });
      notify(`Stock increased for ${name}`, 'success');
      reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not update stock', 'error');
    }
  };

  return (
    <>
      <div className="admin__topbar">
        <div>
          <span className="eyebrow">Studio overview</span>
          <h1>Good to see you</h1>
        </div>
        <div className="row">
          <span className="badge badge--muted">
            {meta ? `images: ${meta.storage === 'supabase' ? 'Supabase Storage' : 'local /uploads'}` : '…'}
          </span>
          <Link className="btn btn--outline btn--sm" to="/admin/enquiries">Open enquiries</Link>
          <Link className="btn btn--sm" to="/admin/products">Add a product</Link>
        </div>
      </div>

      {loading && <div className="skeleton" style={{ height: '120px' }} />}

      {stats && (
        <>
          <div className="stat-grid">
            <div className="stat">
              <span>Pending enquiries</span>
              <strong>{stats.enquiries.pending}</strong>
              <span className="help">Waiting for your approval</span>
            </div>
            <div className="stat">
              <span>Approved orders</span>
              <strong>{stats.enquiries.approved}</strong>
              <span className="help">{inrRaw(stats.enquiries.approved_value)} in the pipeline</span>
            </div>
            <div className="stat">
              <span>Completed</span>
              <strong>{stats.enquiries.completed}</strong>
              <span className="help">{inrRaw(stats.enquiries.earned_value)} closed</span>
            </div>
            <div className="stat">
              <span>Catalogue</span>
              <strong>{stats.products.total}</strong>
              <span className="help">{stats.products.units} pieces in stock</span>
            </div>
            <div className="stat">
              <span>Needs attention</span>
              <strong>{stats.products.low_stock + stats.products.out_of_stock}</strong>
              <span className="help">
                {stats.products.low_stock} low · {stats.products.out_of_stock} made-to-order
              </span>
            </div>
          </div>

          <div className="card">
            <div className="card__head">
              <h2>Pending enquiries</h2>
              <Link className="btn btn--outline btn--sm" to="/admin/enquiries">View all</Link>
            </div>
            {enquiryData?.rows.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Customer</th>
                      <th>Saree</th>
                      <th>Value</th>
                      <th>Received</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {enquiryData.rows.slice(0, 6).map((enquiry) => (
                      <tr key={enquiry.id}>
                        <td><strong>{enquiry.reference}</strong></td>
                        <td>{enquiry.customer_name}<div className="muted small">{enquiry.phone}</div></td>
                        <td>
                          {enquiry.items?.[0]?.product_name || `${enquiry.item_count} item(s)`}
                          {Number(enquiry.item_count) > 1 && (
                            <div className="muted small">+{Number(enquiry.item_count) - 1} more</div>
                          )}
                        </td>
                        <td>{inrRaw(enquiry.quoted_total)}</td>
                        <td className="small muted">{relativeTime(enquiry.created_at)}</td>
                        <td>
                          <Link className="btn btn--sm" to={`/admin/enquiries?open=${enquiry.id}`}>
                            <WhatsAppIcon size={13} /> Approve
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">No pending enquiries — everything is approved. 🎉</p>
            )}
          </div>

          <div className="card">
            <div className="card__head">
              <h2>Stock to watch</h2>
              <Link className="btn btn--outline btn--sm" to="/admin/products">Manage stock</Link>
            </div>
            {stats.low_stock.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Saree</th>
                      <th>Stock</th>
                      <th>Threshold</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {stats.low_stock.map((item) => (
                      <tr key={item.id}>
                        <td>{item.name}</td>
                        <td>
                          <span className={`badge badge--${item.stock < 0 ? 'rejected' : 'warn'}`}>
                            {item.stock < 0 ? `oversold ${item.stock}` : item.stock === 0 ? 'made to order' : item.stock}
                          </span>
                        </td>
                        <td className="muted small">{item.low_stock_threshold}</td>
                        <td>
                          <button className="btn btn--outline btn--sm" onClick={() => restock(item.id, item.name)}>
                            +1 woven
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">Every saree is comfortably stocked.</p>
            )}
          </div>
        </>
      )}
    </>
  );
}
