import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const exactSemver=/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
function packageJson(path){return JSON.parse(readFileSync(path,'utf8'))}
function directSpecs(pkg){return Object.entries({...pkg.dependencies,...pkg.devDependencies})}

describe('direct dependency policy',()=>{
  for(const [label,path] of [['Viewer','package.json'],['Control Plane','control-plane/package.json']]){
    it(`${label} uses exact direct dependency versions`,()=>{
      for(const [name,spec] of directSpecs(packageJson(path))){
        expect(spec,`${label} ${name} must be exact, not floating: ${spec}`).toMatch(exactSemver)
      }
    })
  }

  it('pins the Cloudflare Sandbox preview build instead of using the mutable next tag',()=>{
    const spec=packageJson('control-plane/package.json').dependencies['@cloudflare/sandbox']
    expect(spec).toBe('0.13.0-next.738.2')
  })
})
