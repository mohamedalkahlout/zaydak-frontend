import { CustomerForm } from "@/features/customers/components/form/customer-form"

export default async function NewCustomerPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  await params
  return (
    <div className="lg:mx-12">
      <CustomerForm mode="create" />
    </div>
  )
}
