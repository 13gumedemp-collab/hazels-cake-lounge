import Icon from "@/components/Icon";

type PriceItem = {
  item: string;
  size: string;
  price: string;
};

const CAKES: PriceItem[] = [
  { item: "Vanilla cake", size: "8 inch", price: "R400" },
  { item: "Chocolate cake", size: "8 inch", price: "R500" },
  { item: "Red velvet cake", size: "8 inch", price: "R550" },
  { item: "Carrot cake", size: "8 inch", price: "R520" },
];

const BISCUITS: PriceItem[] = [
  { item: "Single-flavour biscuits", size: "500 g", price: "R125" },
  { item: "Assorted biscuits", size: "1 kg", price: "R180" },
  { item: "Assorted biscuits", size: "5 L", price: "R300" },
  { item: "Butter biscuits", size: "5 L", price: "R250" },
  { item: "Ginger biscuits", size: "5 L", price: "R300" },
  { item: "Choc chip biscuits", size: "5 L", price: "R250" },
  { item: "Jam tarts", size: "5 L", price: "R300" },
  { item: "Scones", size: "5 L", price: "R250" },
  { item: "Scones", size: "10 L", price: "R480" },
];

const RUSKS: PriceItem[] = [
  { item: "Rusks", size: "500 g", price: "R70" },
  { item: "Buttermilk rusks", size: "500 g", price: "R70" },
  { item: "All bran rusks", size: "500 g", price: "R90" },
  { item: "Raisin rusks", size: "500 g", price: "R90" },
];

const MEMORY_GROUPS = [
  { price: "R70", note: "Plain and buttermilk rusks", accent: "soft" },
  { price: "R90", note: "All bran and raisin rusks", accent: "soft" },
  { price: "R250", note: "Butter biscuits, choc chip biscuits and 5 L scones", accent: "gold" },
  { price: "R300", note: "5 L assorted biscuits, ginger biscuits and jam tarts", accent: "gold" },
];

function PriceList({ title, items }: { title: string; items: PriceItem[] }) {
  return (
    <section className="surface-card price-list">
      <h2>{title}</h2>
      <div className="price-list__rows">
        {items.map((entry) => (
          <div key={`${entry.item}-${entry.size}`} className="price-list__row">
            <span><strong>{entry.item}</strong><small>{entry.size}</small></span>
            <b>{entry.price}</b>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function PricingPage() {
  return (
    <div className="admin-page max-w-7xl mx-auto">
      <div className="page-heading">
        <p className="eyebrow">Private business reference</p>
        <h1>Price Guide</h1>
        <p className="text-creamSoft mt-2">A quick price prompt for orders and customer conversations. These prices are only visible in the Command Centre.</p>
      </div>

      <section className="surface-card pricing-memory mt-6">
        <div className="pricing-memory__intro">
          <div className="pricing-memory__icon"><Icon name="tag" className="w-5 h-5" /></div>
          <div>
            <p className="eyebrow">Memory key</p>
            <h2>Remember the repeated prices</h2>
            <p>Start here when you are quoting a familiar baked item. The full reference below keeps every size clear.</p>
          </div>
        </div>
        <div className="pricing-memory__groups">
          {MEMORY_GROUPS.map((group) => (
            <article key={group.price} className={`pricing-memory__group pricing-memory__group--${group.accent}`}>
              <strong>{group.price}</strong>
              <p>{group.note}</p>
            </article>
          ))}
        </div>
        <p className="pricing-memory__note"><b>Two easy extras:</b> single-flavour biscuits are R125 per 500 g, assorted biscuits are R180 per 1 kg, and 10 L scones are R480.</p>
      </section>

      <div className="pricing-grid mt-4">
        <PriceList title="Everyday cakes" items={CAKES} />
        <PriceList title="Biscuits and baked treats" items={BISCUITS} />
        <PriceList title="Rusks" items={RUSKS} />
      </div>
    </div>
  );
}
