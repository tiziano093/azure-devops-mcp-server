@description('Azure region for all resources.')
param location string = resourceGroup().location

@description('Name of the Container App (also used as prefix for related resources).')
param containerAppName string

@description('Docker image to deploy, e.g. ghcr.io/org/repo:sha-abc123.')
param imageName string

@description('Azure DevOps organization name.')
@secure()
param azureDevOpsOrg string

@description('Azure DevOps Personal Access Token.')
@secure()
param azureDevOpsPat string

@description('Azure DevOps default project name (optional).')
param azureDevOpsProject string = ''

@description('MCP Bearer auth token for HTTP transport.')
@secure()
param mcpAuthToken string

@description('GHCR username (GitHub actor) for pulling images.')
param ghcrUsername string

@description('GHCR pull token (GitHub PAT with packages:read scope).')
@secure()
param ghcrToken string

@description('Minimum number of container replicas.')
param minReplicas int = 1

@description('Maximum number of container replicas.')
param maxReplicas int = 3

@description('CPU cores allocated per replica (e.g. 0.5).')
param cpuCores string = '0.5'

@description('Memory allocated per replica (e.g. 1Gi).')
param memoryGi string = '1Gi'

@description('Log retention in days.')
param logRetentionDays int = 30

@description('Tags to apply to all resources.')
param tags object = {}

var logWorkspaceName = '${containerAppName}-logs'
var envName = '${containerAppName}-env'

// ---------- Log Analytics Workspace ----------
resource logWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logWorkspaceName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: logRetentionDays
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
  }
}

// ---------- Container Apps Environment ----------
resource containerAppEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: envName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logWorkspace.properties.customerId
        sharedKey: logWorkspace.listKeys().primarySharedKey
      }
    }
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

// ---------- Container App ----------
resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: containerAppName
  location: location
  tags: tags
  properties: {
    managedEnvironmentId: containerAppEnv.id
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 3000
        transport: 'http'
        allowInsecure: false
        traffic: [
          {
            weight: 100
            latestRevision: true
          }
        ]
      }
      registries: [
        {
          server: 'ghcr.io'
          username: ghcrUsername
          passwordSecretRef: 'ghcr-token'
        }
      ]
      secrets: [
        { name: 'ghcr-token', value: ghcrToken }
        { name: 'azure-devops-pat', value: azureDevOpsPat }
        { name: 'mcp-auth-token', value: mcpAuthToken }
      ]
    }
    template: {
      containers: [
        {
          name: containerAppName
          image: imageName
          env: [
            { name: 'PORT', value: '3000' }
            { name: 'MCP_HTTP_PATH', value: '/mcp' }
            { name: 'AZURE_DEVOPS_ORG', value: azureDevOpsOrg }
            { name: 'AZURE_DEVOPS_PROJECT', value: azureDevOpsProject }
            { name: 'AZURE_DEVOPS_PAT', secretRef: 'azure-devops-pat' }
            { name: 'MCP_AUTH_TOKEN', secretRef: 'mcp-auth-token' }
            { name: 'CACHE_TTL_SECONDS', value: '60' }
            { name: 'CACHE_MAX_SIZE', value: '500' }
          ]
          resources: {
            cpu: json(cpuCores)
            memory: memoryGi
          }
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/healthz'
                port: 3000
                scheme: 'HTTP'
              }
              initialDelaySeconds: 10
              periodSeconds: 30
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/healthz'
                port: 3000
                scheme: 'HTTP'
              }
              initialDelaySeconds: 5
              periodSeconds: 10
              failureThreshold: 3
            }
            {
              type: 'Startup'
              httpGet: {
                path: '/healthz'
                port: 3000
                scheme: 'HTTP'
              }
              initialDelaySeconds: 3
              periodSeconds: 5
              failureThreshold: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: [
          {
            name: 'http-scale'
            http: {
              metadata: {
                concurrentRequests: '20'
              }
            }
          }
        ]
      }
    }
  }
}

// ---------- Outputs ----------
output fqdn string = containerApp.properties.configuration.ingress.fqdn
output containerAppId string = containerApp.id
output containerAppName string = containerApp.name
output healthUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}/healthz'
output mcpUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}/mcp'
