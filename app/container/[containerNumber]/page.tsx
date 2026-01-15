import { getContainerDetails, getTransitStages } from "@/app/actions/entry/actions";
import ContainerDetailView from "@/components/shipment/ContainerDetailView";
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

    // Enhance container data for the page (initial calculations if needed on server)
    const transitStages = await getTransitStages();

    return (
        <div className="bg-slate-50 min-h-screen">
            <ContainerDetailView initialData={container} transitStages={transitStages} />
        </div>
    );
}
