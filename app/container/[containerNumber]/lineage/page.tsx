import { getContainerDetails } from "@/app/actions/entry/actions";
import DataLineageView from "@/components/shipment/DataLineageView";
import { notFound } from "next/navigation";

interface PageProps {
    params: {
        containerNumber: string;
    };
}

export default async function Page({ params }: PageProps) {
    const resolvedParams = await params;
    const { containerNumber } = resolvedParams;
    const container = await getContainerDetails(containerNumber);

    if (!container) {
        notFound();
    }

    return (
        <DataLineageView data={container} />
    );
}
