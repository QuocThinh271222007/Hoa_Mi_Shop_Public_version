import Link from 'next/link';

const NAV_LINKS = [
  { href: '/admin',             label: 'Overview'    },
  { href: '/admin/products',    label: 'Products'    },
  { href: '/admin/collections', label: 'Collections' },
  { href: '/admin/banners',     label: 'Banners'     },
  { href: '/admin/inventory',   label: 'Inventory'   },
  { href: '/admin/orders',      label: 'Orders'      },
  { href: '/admin/payments',    label: 'Payments'    },
  { href: '/admin/discounts',   label: 'Discounts'   },
  { href: '/admin/locations',   label: 'Khu vực ship' },
  { href: '/admin/settings',    label: 'Settings'    },
  { href: '/admin/media',       label: 'Media'       },
  { href: '/admin/support',     label: 'Support'     },
  { href: '/admin/analytics',   label: 'Analytics'   },
  { href: '/admin/blog',        label: 'Blog'        },
  { href: '/admin/about',       label: 'About Us'    },
  { href: '/admin/policies',    label: 'Chính sách'  },
  { href: '/admin/feedback',    label: 'Feedback'    },
  { href: '/admin/comments',    label: 'Comments'    },
  { href: '/admin/customers',   label: 'Customers'   },
  { href: '/admin/blacklist',   label: 'Blacklist'   },
  { href: '/admin/wishlist',    label: 'Wishlist'    },
  { href: '/admin/reports',     label: 'Reports'     },
];

export function AdminShell({
  email,
  activePath,
  children,
}: {
  email: string;
  activePath?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar__brand">
          <span className="admin-sidebar__brand-name">Cúc Họa Mi</span>
          <span className="admin-sidebar__brand-sub">Admin</span>
        </div>
        <nav className="admin-sidebar__nav">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`admin-sidebar__link${activePath === href ? ' admin-sidebar__link--active' : ''}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="admin-sidebar__footer">{email}</div>
      </aside>
      <div className="admin-main">{children}</div>
    </div>
  );
}
