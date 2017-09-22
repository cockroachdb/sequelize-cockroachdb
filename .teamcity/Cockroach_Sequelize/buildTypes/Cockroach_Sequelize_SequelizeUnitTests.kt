package Cockroach_Sequelize.buildTypes

import jetbrains.buildServer.configs.kotlin.v10.*
import jetbrains.buildServer.configs.kotlin.v10.triggers.VcsTrigger
import jetbrains.buildServer.configs.kotlin.v10.triggers.VcsTrigger.*
import jetbrains.buildServer.configs.kotlin.v10.triggers.vcs

object Cockroach_Sequelize_SequelizeUnitTests : BuildType({
    uuid = "a5f9a913-5926-4696-8768-a0738a6211bf"
    extId = "Cockroach_Sequelize_SequelizeUnitTests"
    name = "Sequelize Unit Tests"

    vcs {
        root("Cockroach_HttpsGithubComCockroachdbSequelizeCockroachdbRefsHeadsMaster")

    }

    triggers {
        vcs {
        }
    }
})
