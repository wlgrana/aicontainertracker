
import { getDashboardData } from './app/actions/entry/actions';

async function verify() {
    console.log("Fetching Page 1...");
    const p1 = await getDashboardData(1, 5);
    console.log(`Page 1: ${p1.containers.length} containers. Total: ${p1.totalCount}`);
    if (p1.containers.length > 0) {
        console.log(`First Container P1: ${p1.containers[0].containerNumber}`);
    }

    console.log("\nFetching Page 2...");
    const p2 = await getDashboardData(2, 5);
    console.log(`Page 2: ${p2.containers.length} containers. Total: ${p2.totalCount}`);
    if (p2.containers.length > 0) {
        console.log(`First Container P2: ${p2.containers[0].containerNumber}`);
    }

    if (p1.containers[0].containerNumber !== p2.containers[0].containerNumber) {
        console.log("\nSUCCESS: Page 1 and Page 2 start with different containers.");
    } else {
        console.log("\nFAIL: Page 1 and Page 2 start with same container.");
    }
}

verify();
