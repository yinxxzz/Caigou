'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import classNames from 'classnames';

const menuItems = [
  { name: '新增活动', path: '/new-activity' },
  { name: '本期消耗情况', path: '/current-consumption' },
  { name: '活动复盘', path: '/retrospect' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-gray-900 text-white h-screen fixed left-0 top-0 overflow-y-auto">
      <div className="p-6">
        <h1 className="text-xl font-bold mb-8">赠品采购预测工作台</h1>
        <nav>
          <ul className="space-y-2">
            {menuItems.map((item) => (
              <li key={item.path}>
                <Link
                  href={item.path}
                  className={classNames(
                    'block px-4 py-2 rounded-lg transition-colors',
                    pathname === item.path
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800'
                  )}
                >
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
