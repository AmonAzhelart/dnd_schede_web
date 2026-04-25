param(
    [string]$Source = 'src\components\dashboard\widgets\widgets.css',
    [string]$OutDir = 'src\components\dashboard\widgets\styles'
)

$ErrorActionPreference = 'Stop'

$lines = Get-Content -Path $Source
$total = $lines.Count

$sections = @(
    @{ start = 1;    name = '_shared.css'         },
    @{ start = 119;  name = 'hp.css'              },
    @{ start = 590;  name = 'defenses.css'        },
    @{ start = 1129; name = 'conditions.css'      },
    @{ start = 1376; name = 'attacks.css'         },
    @{ start = 1766; name = 'spell-slots.css'     },
    @{ start = 2239; name = 'class-features.css'  },
    @{ start = 2334; name = 'feats.css'           },
    @{ start = 2413; name = 'stats.css'           },
    @{ start = 2667; name = 'skills.css'          },
    @{ start = 2783; name = 'inventory.css'       },
    @{ start = 2882; name = 'currency.css'        },
    @{ start = 3166; name = 'languages.css'       },
    @{ start = 3243; name = 'movement.css'        },
    @{ start = 3320; name = 'notes.css'           },
    @{ start = 3356; name = 'abilities.css'       },
    @{ start = 3610; name = 'modifiers.css'       }
)

if (-not (Test-Path $OutDir)) {
    New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
}

for ($i = 0; $i -lt $sections.Count; $i++) {
    $startIdx = $sections[$i].start - 1
    $endIdx   = if ($i -lt $sections.Count - 1) { $sections[$i + 1].start - 2 } else { $total - 1 }
    $slice    = $lines[$startIdx..$endIdx]
    $outPath  = Join-Path $OutDir $sections[$i].name
    Set-Content -Path $outPath -Value $slice -Encoding UTF8
    Write-Host "Wrote $outPath  (lines $($startIdx + 1)-$($endIdx + 1) = $($slice.Count))"
}

# Now generate the new widgets.css with only @import directives
$importLines = @('/* Aggregator: imports each widget stylesheet. Do not add styles here. */')
foreach ($s in $sections) {
    $importLines += "@import './styles/$($s.name)';"
}
Set-Content -Path $Source -Value $importLines -Encoding UTF8
Write-Host "Rewrote $Source with $($importLines.Count - 1) @import directives."
