# module dependencies
should = require 'should'
vinyl  = require 'vinyl'

# SUT
coffeelint = require '../'

describe 'gulp-coffeelint', ->
    describe 'coffeelint()', ->
        describe 'should detect (non-Literate) CoffeeScript', ->
            it 'on .coffee with Literate contents', (done) ->
                data = counter: 0

                fakeFile = new vinyl
                    path: './test/fixture/file.coffee',
                    cwd: './test/',
                    base: './test/fixture/',
                    contents: Buffer.from 'Comments!\n  yeah()'

                stream = coffeelint {}

                stream.on 'data', (newFile) ->
                    ++data.counter
                    should.exist(newFile.coffeelint.success)
                    should.exist(newFile.coffeelint.literate)
                    newFile.coffeelint.success.should.be.false
                    newFile.coffeelint.literate.should.be.false

                stream.once 'end', ->
                    data.counter.should.equal 1
                    done()

                stream.write fakeFile
                stream.end()

            it 'on .litcoffee with literate: false', (done) ->
                data = counter: 0

                fakeFile = new vinyl
                    path: './test/fixture/file.litcoffee',
                    cwd: './test/',
                    base: './test/fixture/',
                    contents: Buffer.from 'Comments!\n  yeah()'

                stream = coffeelint false

                stream.on 'data', (newFile) ->
                    ++data.counter
                    should.exist(newFile.coffeelint.success)
                    should.exist(newFile.coffeelint.literate)
                    newFile.coffeelint.success.should.be.false
                    newFile.coffeelint.literate.should.be.false

                stream.once 'end', ->
                    data.counter.should.equal 1
                    done()

                stream.write fakeFile
                stream.end()

            for extension in ['.coffee', '.js', '.custom', '.md', '.', '']
                ((extension) ->
                    it "on #{(extension or 'no extension')}", (done) ->
                        data = counter: 0

                        fakeFile = new vinyl
                            path: "./test/fixture/file' #{extension}",
                            cwd: './test/',
                            base: './test/fixture/',
                            contents: Buffer.from 'yeah()'

                        stream = coffeelint {}

                        stream.on 'data', (newFile) ->
                            ++data.counter
                            should.exist(newFile.coffeelint.success)
                            should.exist(newFile.coffeelint.literate)
                            newFile.coffeelint.success.should.be.true
                            newFile.coffeelint.literate.should.be.false

                        stream.once 'end', ->
                            data.counter.should.equal 1
                            done()

                        stream.write fakeFile
                        stream.end()
                )(extension)

        describe 'should detect Literate CoffeeScript', ->
            for extension in ['.litcoffee', '.coffee.md']
                ((extension) ->
                    it 'on ' + extension, (done) ->
                        data = counter: 0

                        fakeFile = new vinyl
                            path: './test/fixture/file' + extension,
                            cwd: './test/',
                            base: './test/fixture/',
                            contents: Buffer.from 'Comments!\n  yeah()'

                        stream = coffeelint {}

                        stream.on 'data', (newFile) ->
                            ++data.counter
                            should.exist(newFile.coffeelint.success)
                            should.exist(newFile.coffeelint.literate)
                            newFile.coffeelint.success.should.be.true
                            newFile.coffeelint.literate.should.be.true

                        stream.once 'end', ->
                            data.counter.should.equal 1
                            done()

                        stream.write fakeFile
                        stream.end()
                )(extension)

            it 'on .coffee with literate: true', (done) ->
                data = counter: 0

                fakeFile = new vinyl
                    path: './test/fixture/file.coffee',
                    cwd: './test/',
                    base: './test/fixture/',
                    contents: Buffer.from 'yeah()'

                stream = coffeelint true

                stream.on 'data', (newFile) ->
                    ++data.counter
                    should.exist(newFile.coffeelint.success)
                    should.exist(newFile.coffeelint.literate)
                    newFile.coffeelint.success.should.be.false
                    newFile.coffeelint.literate.should.be.true

                stream.once 'end', ->
                    data.counter.should.equal 1
                    done()

                stream.write fakeFile
                stream.end()

        describe 'for multiple files', ->
            it 'should detect CS and LCS in single stream', (done) ->
                data = counter: 0

                extensions =
                    '.coffee': false,
                    '.litcoffee': true,
                    '.js': false,
                    '.coffee.md': true,
                    '.md': false

                fakeFiles = for extension, literate of extensions
                    fakeFile = new vinyl
                        path: './test/fixture/file' + extension,
                        cwd: './test/',
                        base: './test/fixture/',
                        contents: Buffer.from 'yeah()'
                    fakeFile.literate = literate
                    fakeFile

                stream = coffeelint {}

                stream.on 'data', (newFile) ->
                    should.exist(newFile.coffeelint.success)
                    should.exist(newFile.coffeelint.literate)
                    newFile.coffeelint.literate.should.equal(
                        newFile.literate)
                    ++data.counter

                stream.once 'end', ->
                    data.counter.should.equal 5
                    done()

                stream.write fakeFile for fakeFile in fakeFiles
                stream.end()

            it 'should treat all as Literate when literate: true', (done) ->
                data = counter: 0

                extensions = [
                    '.coffee'
                    '.litcoffee'
                    '.js'
                    '.coffee.md'
                    '.md'
                ]

                fakeFiles = for extension in extensions
                    fakeFile = new vinyl
                        path: './test/fixture/file' + extension,
                        cwd: './test/',
                        base: './test/fixture/',
                        contents: Buffer.from 'yeah()'

                stream = coffeelint {}, true

                stream.on 'data', (newFile) ->
                    should.exist(newFile.coffeelint.success)
                    should.exist(newFile.coffeelint.literate)
                    newFile.coffeelint.literate.should.be.true
                    ++data.counter

                stream.once 'end', ->
                    data.counter.should.equal 5
                    done()

                stream.write fakeFile for fakeFile in fakeFiles
                stream.end()

            it 'should treat all as non-Lit when literate: false', (done) ->
                data = counter: 0

                extensions = [
                    '.coffee'
                    '.litcoffee'
                    '.js'
                    '.coffee.md'
                    '.md'
                ]

                fakeFiles = for extension in extensions
                    fakeFile = new vinyl
                        path: './test/fixture/file' + extension,
                        cwd: './test/',
                        base: './test/fixture/',
                        contents: Buffer.from 'yeah()'

                stream = coffeelint {}, false

                stream.on 'data', (newFile) ->
                    should.exist(newFile.coffeelint.success)
                    should.exist(newFile.coffeelint.literate)
                    newFile.coffeelint.literate.should.be.false
                    ++data.counter

                stream.once 'end', ->
                    data.counter.should.equal 5
                    done()

                stream.write fakeFile for fakeFile in fakeFiles
                stream.end()
