import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
export async function listProjects() {
    try {
        const { stdout } = await execAsync('doctl projects list --format ID,Name,Description,Environment,IsDefault,CreatedAt,UpdatedAt --no-header', { timeout: 30000 });
        const projects = stdout.trim().split('\n')
            .filter(line => line.trim())
            .map(line => {
            const parts = line.split(/\s{2,}/); // Split on multiple spaces
            return {
                id: parts[0] || '',
                name: parts[1] || '',
                description: parts[2] || '',
                environment: (parts[3] || 'Development'),
                isDefault: parts[4] === 'true',
                createdAt: parts[5] || '',
                updatedAt: parts[6] || '',
            };
        });
        return { success: true, projects };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, projects: [], error: message };
    }
}
export async function createProject(name, description = '', environment = 'Development') {
    try {
        const descFlag = description ? `--description "${description}"` : '';
        const { stdout, stderr } = await execAsync(`doctl projects create --name "${name}" ${descFlag} --environment ${environment} --format ID,Name,Description,Environment --no-header`, { timeout: 30000 });
        if (stderr && !stdout) {
            return { success: false, error: stderr };
        }
        const parts = stdout.trim().split(/\s{2,}/);
        const project = {
            id: parts[0] || '',
            name: parts[1] || name,
            description: parts[2] || description,
            environment: (parts[3] || environment),
            isDefault: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        return { success: true, project };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message };
    }
}
export async function assignAppToProject(projectId, appId) {
    try {
        // App Platform apps use URN format: do:app:app-id
        await execAsync(`doctl projects resources assign ${projectId} --resource=do:app:${appId}`, { timeout: 30000 });
        return { success: true };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message };
    }
}
export async function getProjectApps(projectId) {
    try {
        const { stdout } = await execAsync(`doctl projects resources list ${projectId} --format URN --no-header`, { timeout: 30000 });
        const appIds = stdout.trim().split('\n')
            .filter(line => line.startsWith('do:app:'))
            .map(urn => urn.replace('do:app:', ''));
        return { success: true, appIds };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, appIds: [], error: message };
    }
}
export async function checkDoctl() {
    try {
        await execAsync('doctl version');
        const { stdout } = await execAsync('doctl account get --format Email --no-header');
        return stdout.trim().length > 0;
    }
    catch {
        return false;
    }
}
export async function deploy(appspecPath) {
    try {
        const { stdout, stderr } = await execAsync(`doctl apps create --spec "${appspecPath}" --format ID,DefaultIngress --no-header`, { timeout: 120000 });
        if (stderr && !stdout) {
            return {
                success: false,
                error: stderr,
            };
        }
        const parts = stdout.trim().split(/\s+/);
        const appId = parts[0];
        const url = parts[1] || '';
        return {
            success: true,
            appId,
            url: url.startsWith('http') ? url : `https://${url}`,
            dashboardUrl: `https://cloud.digitalocean.com/apps/${appId}`,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            error: message,
        };
    }
}
export async function updateApp(appId, appspecPath) {
    try {
        const { stdout, stderr } = await execAsync(`doctl apps update ${appId} --spec "${appspecPath}" --format ID,DefaultIngress --no-header`, { timeout: 120000 });
        if (stderr && !stdout) {
            return {
                success: false,
                error: stderr,
            };
        }
        const parts = stdout.trim().split(/\s+/);
        const url = parts[1] || '';
        return {
            success: true,
            appId,
            url: url.startsWith('http') ? url : `https://${url}`,
            dashboardUrl: `https://cloud.digitalocean.com/apps/${appId}`,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            error: message,
        };
    }
}
export async function deleteApp(appId) {
    try {
        await execAsync(`doctl apps delete ${appId} --force`, { timeout: 60000 });
        return { success: true };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message };
    }
}
export async function getAppLogs(appId, component) {
    try {
        const componentFlag = component ? `--component ${component}` : '';
        const { stdout } = await execAsync(`doctl apps logs ${appId} ${componentFlag} --tail 100`, { timeout: 30000 });
        return stdout;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to get logs: ${message}`);
    }
}
//# sourceMappingURL=doctl.js.map