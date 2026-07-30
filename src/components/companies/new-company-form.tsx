"use client";

import { useRouter } from "next/navigation";
import { CompanyForm, type FormRefData } from "@/components/companies/company-form";

export function NewCompanyForm({ refData }: { refData: FormRefData }) {
  const router = useRouter();
  return <CompanyForm refData={refData} onCancel={() => router.push("/companies")} />;
}
