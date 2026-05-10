import WorkArea from '@/components/layout/WorkArea';

const requiredSkills = [
  {
    name: 'gift-procurement-advisor',
    title: '赠品采购建议 Skill',
    description: '用于生成采购测算、采购建议和最终 SKU 表 JSON。',
  },
  {
    name: 'supply-chain-inventory-realtime',
    title: '供应链实时库存 Skill',
    description: '用于查询供应链实时库存，判断赠品库存是否充足。',
  },
];

export default function SkillDownloadPage() {
  return (
    <WorkArea>
      <div className="max-w-5xl">
        <section className="mb-6 rounded-lg bg-white p-8 shadow">
          <p className="text-sm font-medium text-blue-600">多人使用配置</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">工作台 Skill 下载</h1>
          <p className="mt-3 max-w-3xl text-gray-600">
            部署后的使用者需要先安装这些 Cursor Skill，才能让 Cursor 按工作台口径生成采购建议、
            查询实时库存并回填 JSON。
          </p>
          <a
            href="/downloads/gift-procurement-workbench-skills.zip"
            download
            className="mt-6 inline-flex rounded-md bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700"
          >
            下载必须 Skill 包
          </a>
        </section>

        <section className="mb-6 rounded-lg bg-white p-6 shadow">
          <h2 className="text-xl font-semibold text-gray-900">包含的 Skill</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {requiredSkills.map((skill) => (
              <div key={skill.name} className="rounded-lg border border-gray-200 p-4">
                <p className="text-sm font-medium text-gray-500">{skill.name}</p>
                <h3 className="mt-1 text-lg font-semibold text-gray-900">{skill.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{skill.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-xl font-semibold text-gray-900">安装方式</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-gray-700">
            <li>下载并解压 Skill 包。</li>
            <li>把解压后的 `.cursor/skills` 目录复制到使用者的项目根目录。</li>
            <li>重新打开 Cursor，确认工作台项目能识别这些 Skill。</li>
            <li>在“新增活动”页面复制数据包给 Cursor，让 Cursor 按 Skill 口径生成 JSON。</li>
          </ol>
        </section>
      </div>
    </WorkArea>
  );
}
