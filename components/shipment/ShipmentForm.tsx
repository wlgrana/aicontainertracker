"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { createShipment } from "@/app/actions/entry/actions";

export function ManualShipmentForm() {
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData(e.currentTarget);

        const result = await createShipment(formData);

        setLoading(false);
        if (result?.error) {
            alert("Error: " + result.error);
        } else {
            alert("Shipment Saved!");
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Manual Shipment Entry</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Shipment Ref</Label>
                            <Input name="shipmentReference" placeholder="S-10001" required />
                        </div>
                        <div className="space-y-2">
                            <Label>HBL</Label>
                            <Input name="hbl" placeholder="HBL123" />
                        </div>
                        <div className="space-y-2">
                            <Label>Carrier</Label>
                            <Input name="carrier" placeholder="MSC" />
                        </div>
                        <div className="space-y-2">
                            <Label>Forwarder</Label>
                            <Input name="forwarder" placeholder="Kuehne+Nagel" />
                        </div>
                    </div>
                    <Button type="submit" disabled={loading}>
                        {loading ? "Saving..." : "Save Shipment"}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
