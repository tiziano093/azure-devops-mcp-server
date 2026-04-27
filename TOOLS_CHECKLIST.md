# Azure DevOps MCP Server — API Coverage Checklist

Legend: ✅ implemented · ⬜ missing

---

## Core / Projects
| Status | Tool | API |
|--------|------|-----|
| ✅ | `list_projects` | GET projects |
| ✅ | `list_all_projects` | GET projects (auto-paginated) |
| ✅ | `get_project` | GET projects/{id} |
| ✅ | `list_teams` | GET projects/{id}/teams |
| ✅ | `list_team_members` | GET projects/{id}/teams/{tid}/members |
| ✅ | `list_org_repositories` | cross-project repo scan |
| ✅ | `get_connection_data` | GET connectionData |
| ✅ | `create_project` | POST projects |
| ✅ | `get_operation` | GET operations/{id} |

---

## Work Items / Boards
| Status | Tool | API |
|--------|------|-----|
| ✅ | `search_work_items_wiql` | POST wit/wiql |
| ✅ | `batch_get_work_items` | POST wit/workitemsbatch |
| ✅ | `get_work_item` | GET wit/workitems/{id} |
| ✅ | `create_work_item` | PATCH wit/workitems/${type} |
| ✅ | `update_work_item_state` | PATCH wit/workitems/{id} |
| ✅ | `update_work_item_fields` | PATCH wit/workitems/{id} |
| ✅ | `delete_work_item` | DELETE wit/workitems/{id} |
| ✅ | `restore_work_item` | PATCH wit/recyclebin/{id} |
| ✅ | `list_recycle_bin` | GET wit/recyclebin |
| ✅ | `add_work_item_comment` | POST wit/workItems/{id}/comments |
| ✅ | `list_work_item_comments` | GET wit/workItems/{id}/comments |
| ✅ | `list_work_item_history` | GET wit/workItems/{id}/updates |
| ✅ | `manage_work_item_links` | PATCH wit/workitems/{id} (relations) |
| ✅ | `bulk_update_work_items` | POST wit/workitemsbatch + PATCH |
| ✅ | `get_backlog_work_items` | POST wit/wiql |
| ✅ | `list_current_sprint_work_items` | GET work/teamsettings/iterations + wiql |
| ✅ | `list_team_iterations` | GET work/teamsettings/iterations |
| ✅ | `get_board_status` | GET work/boards |
| ✅ | `get_team_capacity` | GET work/teamsettings/iterations/{id}/capacities |
| ✅ | `list_area_paths` | GET wit/classificationnodes/areas |
| ✅ | `list_iteration_paths` | GET wit/classificationnodes/iterations |
| ✅ | `create_classification_node` | POST wit/classificationnodes/{type} |
| ✅ | `update_classification_node` | PATCH wit/classificationnodes/{type}/{path} |
| ✅ | `delete_classification_node` | DELETE wit/classificationnodes/{type}/{path} |
| ✅ | `list_work_item_templates` | GET wit/templates |
| ✅ | `list_work_items_cross_project` | POST wit/wiql (multi-project) |

---

## Process / Work Item Metadata
| Status | Tool | API |
|--------|------|-----|
| ✅ | `list_processes` | GET work/processes |
| ✅ | `get_process` | GET work/processes/{id} |
| ✅ | `list_work_item_types` | GET wit/workitemtypes |
| ✅ | `get_work_item_type` | GET wit/workitemtypes/{type} |
| ✅ | `list_work_item_fields` | GET wit/fields |
| ✅ | `get_work_item_field` | GET wit/fields/{field} |

---

## Git / Repositories
| Status | Tool | API |
|--------|------|-----|
| ✅ | `list_repositories` | GET git/repositories |
| ✅ | `get_repository` | GET git/repositories/{id} |
| ✅ | `create_repository` | POST git/repositories |
| ✅ | `delete_repository` | DELETE git/repositories/{id} |
| ✅ | `list_branches` | GET git/repositories/{id}/refs?filter=heads |
| ✅ | `create_branch` | POST git/repositories/{id}/refs |
| ✅ | `delete_branch` | POST git/repositories/{id}/refs (null newObjectId) |
| ✅ | `list_tags` | GET git/repositories/{id}/refs?filter=tags |
| ✅ | `create_annotated_tag` | POST git/repositories/{id}/annotatedtags |
| ✅ | `list_commits` | GET git/repositories/{id}/commits |
| ✅ | `get_commit_diff` | GET git/repositories/{id}/diffs/commits |
| ✅ | `get_repository_stats` | GET git/repositories/{id}/stats/branches |
| ✅ | `get_file_content` | GET git/repositories/{id}/items |
| ✅ | `push_to_repository` | POST git/repositories/{id}/pushes |
| ✅ | `list_pull_requests` | GET git/repositories/{id}/pullrequests |
| ✅ | `get_pull_request` | GET git/repositories/{id}/pullrequests/{id} |
| ✅ | `create_pull_request` | POST git/repositories/{id}/pullrequests |
| ✅ | `update_pull_request` | PATCH git/repositories/{id}/pullrequests/{id} |
| ✅ | `abandon_pull_request` | PATCH git/repositories/{id}/pullrequests/{id} |
| ✅ | `approve_pull_request` | PUT git/.../reviewers/{userId} |
| ✅ | `request_pull_request_reviewers` | PUT git/.../reviewers/{userId} |
| ✅ | `get_pull_request_diff` | GET git/.../iterations/{id}/changes |
| ✅ | `get_pull_request_threads` | GET git/.../pullRequests/{id}/threads |
| ✅ | `create_pull_request_comment` | POST git/.../pullRequests/{id}/threads |
| ✅ | `list_pr_work_items` | GET git/.../pullRequests/{id}/workitems |
| ✅ | `search_code` | POST almsearch/search/codesearchresults |

---

## Pipelines / Build
| Status | Tool | API |
|--------|------|-----|
| ✅ | `list_pipelines` | GET pipelines |
| ✅ | `list_build_pipelines` | GET build/definitions |
| ✅ | `create_pipeline` | POST pipelines |
| ✅ | `queue_build` | POST build/builds |
| ✅ | `run_pipeline` | POST pipelines/{id}/runs |
| ✅ | `list_builds` | GET build/builds |
| ✅ | `get_build` | GET build/builds/{id} |
| ✅ | `get_pipeline_run` | GET pipelines/{id}/runs/{runId} |
| ✅ | `cancel_build` | PATCH build/builds/{id} |
| ✅ | `retry_build_stage` | PATCH build/builds/{id}/stages/{name} |
| ✅ | `get_build_timeline` | GET build/builds/{id}/timeline |
| ✅ | `get_failed_build_steps` | GET build/builds/{id}/timeline + logs |
| ✅ | `get_pipeline_logs` | GET build/builds/{id}/logs |
| ✅ | `list_build_artifacts` | GET build/builds/{id}/artifacts |
| ✅ | `list_pending_approvals` | GET pipelines/approvals |
| ✅ | `update_pipeline_approval` | PATCH pipelines/approvals |
| ✅ | `manage_variable_groups` | GET/POST/PUT distributedtask/variablegroups |
| ✅ | `list_task_groups` | GET distributedtask/taskgroups |

---

## Releases (Classic)
| Status | Tool | API |
|--------|------|-----|
| ✅ | `list_release_pipelines` | GET vsrm release/definitions |
| ✅ | `get_release_pipeline` | GET vsrm release/definitions/{id} |
| ✅ | `list_releases` | GET vsrm release/releases |
| ✅ | `get_release` | GET vsrm release/releases/{id} |
| ✅ | `create_release` | POST vsrm release/releases |
| ✅ | `update_release_environment` | PATCH vsrm release/releases/{id}/environments/{envId} |
| ✅ | `list_deployments` | GET vsrm release/deployments |

---

## Environments (YAML Pipelines)
| Status | Tool | API |
|--------|------|-----|
| ✅ | `list_environments` | GET pipelines/environments |
| ✅ | `get_environment` | GET pipelines/environments/{id} |
| ✅ | `create_environment` | POST pipelines/environments |
| ✅ | `delete_environment` | DELETE pipelines/environments/{id} |
| ✅ | `list_environment_deployments` | GET pipelines/environments/{id}/environmentdeploymentrecords |
| ✅ | `list_check_configurations` | GET pipelines/checks/configurations |
| ✅ | `create_check_configuration` | POST pipelines/checks/configurations |
| ✅ | `update_check_configuration` | PATCH pipelines/checks/configurations/{id} |
| ✅ | `delete_check_configuration` | DELETE pipelines/checks/configurations/{id} |

---

## Agent Pools & Agents
| Status | Tool | API |
|--------|------|-----|
| ✅ | `list_agent_pools` | GET distributedtask/pools |
| ✅ | `get_agent_pool` | GET distributedtask/pools/{id} |
| ✅ | `list_agents` | GET distributedtask/pools/{id}/agents |
| ✅ | `get_agent` | GET distributedtask/pools/{id}/agents/{agentId} |
| ✅ | `list_deployment_groups` | GET distributedtask/deploymentgroups |
| ✅ | `get_deployment_group` | GET distributedtask/deploymentgroups/{id} |
| ✅ | `list_deployment_targets` | GET distributedtask/deploymentgroups/{id}/targets |

---

## Branch Policies
| Status | Tool | API |
|--------|------|-----|
| ✅ | `list_policy_types` | GET policy/types |
| ✅ | `list_policy_configurations` | GET policy/configurations |
| ✅ | `get_policy_configuration` | GET policy/configurations/{id} |
| ✅ | `create_policy_configuration` | POST policy/configurations |
| ✅ | `update_policy_configuration` | PUT policy/configurations/{id} |
| ✅ | `delete_policy_configuration` | DELETE policy/configurations/{id} |

---

## Identity / Graph / Entitlements
| Status | Tool | API |
|--------|------|-----|
| ✅ | `get_current_user` | GET connectionData (reuse) |
| ✅ | `list_org_users` | GET vssps graph/users |
| ✅ | `get_user` | GET vssps graph/users/{descriptor} |
| ✅ | `list_org_groups` | GET vssps graph/groups |
| ✅ | `list_group_members` | GET vssps graph/memberships/{descriptor} |
| ✅ | `add_group_member` | PUT vssps graph/memberships/{memberDescriptor}/{groupDescriptor} |
| ✅ | `remove_group_member` | DELETE vssps graph/memberships/{memberDescriptor}/{groupDescriptor} |
| ✅ | `list_user_entitlements` | GET vsaex userentitlements |
| ✅ | `update_user_entitlement` | PATCH vsaex userentitlements/{id} |

---

## Analytics (OData)
| Status | Tool | API |
|--------|------|-----|
| ✅ | `query_analytics` | GET analytics.dev.azure.com OData (generic) |
| ✅ | `get_work_item_analytics` | WorkItems OData (state counts, age) |
| ✅ | `get_pipeline_analytics` | PipelineRuns OData (pass rate, duration) |
| ✅ | `get_team_velocity` | WorkItemBoardSnapshot OData |

---

## Service Hooks / Webhooks
| Status | Tool | API |
|--------|------|-----|
| ✅ | `list_hook_publishers` | GET hooks/publishers |
| ✅ | `list_hook_consumers` | GET hooks/consumers |
| ✅ | `list_subscriptions` | GET hooks/subscriptions |
| ✅ | `get_subscription` | GET hooks/subscriptions/{id} |
| ✅ | `create_subscription` | POST hooks/subscriptions |
| ✅ | `update_subscription` | PUT hooks/subscriptions/{id} |
| ✅ | `delete_subscription` | DELETE hooks/subscriptions/{id} |

---

## Test Plans
| Status | Tool | API |
|--------|------|-----|
| ✅ | `list_test_plans` | GET testplan/plans |
| ✅ | `create_test_plan` | POST testplan/plans |
| ✅ | `get_test_plan` | GET testplan/plans/{id} |
| ✅ | `update_test_plan` | PATCH testplan/plans/{id} |
| ✅ | `delete_test_plan` | DELETE testplan/plans/{id} |
| ✅ | `list_test_suites` | GET testplan/plans/{id}/suites |
| ✅ | `create_test_suite` | POST testplan/plans/{id}/suites |
| ✅ | `list_test_cases` | GET testplan/plans/{id}/suites/{sid}/testcase |
| ✅ | `create_test_run` | POST test/runs |
| ✅ | `get_test_runs` | GET test/runs |
| ✅ | `get_test_results` | GET test/runs/{id}/results |
| ✅ | `upload_test_results` | POST test/runs/{id}/results |
| ✅ | `get_test_run_statistics` | GET test/runs/{id}/statistics |

---

## Artifacts
| Status | Tool | API |
|--------|------|-----|
| ✅ | `list_feeds` | GET feeds/packaging/feeds |
| ✅ | `get_feed` | GET feeds/packaging/feeds/{id} |
| ✅ | `create_feed` | POST feeds/packaging/feeds |
| ✅ | `update_feed` | PATCH feeds/packaging/feeds/{id} |
| ✅ | `delete_feed` | DELETE feeds/packaging/feeds/{id} |
| ✅ | `list_packages` | GET feeds/packaging/feeds/{id}/packages |
| ✅ | `get_package_versions` | GET feeds/packaging/feeds/{id}/packages/{pkgId}/versions |
| ✅ | `delete_package_version` | DELETE feeds/packaging/feeds/{id}/packages/{pkgId}/versions/{ver} |

---

## Wiki
| Status | Tool | API |
|--------|------|-----|
| ✅ | `list_wikis` | GET wiki/wikis |
| ✅ | `create_wiki` | POST wiki/wikis |
| ✅ | `get_wiki` | GET wiki/wikis/{id} |
| ✅ | `get_wiki_page` | GET wiki/wikis/{id}/pages |
| ✅ | `create_or_update_wiki_page` | PUT wiki/wikis/{id}/pages |
| ✅ | `delete_wiki_page` | DELETE wiki/wikis/{id}/pages |
| ✅ | `search_wiki_pages` | POST almsearch wikisearchresults |
| ✅ | `list_wiki_page_versions` | GET wiki/wikis/{id}/pages/{pageId}/versions |

---

## Dashboards
| Status | Tool | API |
|--------|------|-----|
| ✅ | `list_dashboards` | GET dashboard/dashboards |
| ✅ | `get_dashboard` | GET dashboard/dashboards/{id} |
| ✅ | `create_dashboard` | POST dashboard/dashboards |
| ✅ | `update_dashboard` | PUT dashboard/dashboards/{id} |
| ✅ | `delete_dashboard` | DELETE dashboard/dashboards/{id} |
| ✅ | `list_widgets` | GET dashboard/dashboards/{id}/widgets |
| ✅ | `create_widget` | POST dashboard/dashboards/{id}/widgets |
| ✅ | `update_widget` | PUT dashboard/dashboards/{id}/widgets/{wid} |
| ✅ | `delete_widget` | DELETE dashboard/dashboards/{id}/widgets/{wid} |

---

## Security & Audit
| Status | Tool | API |
|--------|------|-----|
| ✅ | `list_audit_log` | GET auditservice/audit/auditlog |
| ✅ | `list_security_namespaces` | GET accesscontrol/namespaces |
| ✅ | `get_security_namespace` | GET accesscontrol/namespaces/{id} |
| ✅ | `list_access_control_lists` | GET accesscontrol/acls |
| ✅ | `update_access_control_entries` | POST accesscontrol/acls |
| ✅ | `remove_access_control_entries` | DELETE accesscontrol/acls |
| ✅ | `list_policy_configurations` (security) | GET policy/configurations |

---

## PAT / Token Management
| Status | Tool | API |
|--------|------|-----|
| ✅ | `list_pats` | GET vssps tokens/pats |
| ✅ | `create_pat` | POST vssps tokens/pats |
| ✅ | `revoke_pat` | DELETE vssps tokens/pats |

---

## Summary
| Module | Done |
|--------|------|
| Core / Projects | 9 / 9 |
| Work Items / Boards | 27 / 27 |
| Process Metadata | 6 / 6 |
| Git / Repos | 25 / 25 |
| Pipelines / Build | 18 / 18 |
| Releases (Classic) | 7 / 7 |
| Environments | 9 / 9 |
| Agent Pools | 7 / 7 |
| Branch Policies | 6 / 6 |
| Identity / Graph | 9 / 9 |
| Analytics | 4 / 4 |
| Service Hooks | 7 / 7 |
| Test Plans | 13 / 13 |
| Artifacts | 8 / 8 |
| Wiki | 8 / 8 |
| Dashboards | 9 / 9 |
| Security & Audit | 7 / 7 |
| PAT Management | 3 / 3 |
| **Total** | **182 / 182** |
